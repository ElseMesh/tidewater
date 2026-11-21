import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as E from '../../../src/engine/index.js';
import { Player } from '../../../src/player/Player.js';
import { setMovementSupportKernel } from '../../../src/world/Colliders.js';
import { WorldConnector } from '../../../src/network/WorldConnector.js';
import { WorldPresenceSession } from '../../../src/network/WorldPresenceSession.js';
import { goBuildEnvironment } from '../../../test/go-build-env.mjs';
import { TIDEWATER_LAYOUT } from '../layout.js';
import { TerrainData } from '../terrain/TerrainData.js';
import { tidewaterPierColliders } from './tidewater-pier-colliders.js';
import '../register-components.js';
import '../register-behavior.js';

const projectRoot = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '../../..' );
const tidewaterRoot = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' );
const tempRoot = await mkdtemp( path.join( process.env.PREFIX ? path.join( process.env.PREFIX, 'tmp' ) : '/var/tmp', 'elsemesh-tidewater-presence-' ) );
const dataDir = path.join( tempRoot, 'owner' );
const processes = [];
let session;
let sourceConnector;

function run( command, args, options = {} ) {
	const result = spawnSync( command, args, { encoding: 'utf8', timeout: 180000, ...options } );
	assert.equal( result.status, 0, `${command} ${args.join( ' ' )} failed:\n${result.stdout}\n${result.stderr}` );
	return result.stdout.trim();
}

async function unusedPort() {
	const { createServer } = await import( 'node:net' );
	const server = createServer();
	await new Promise( ( resolve, reject ) => server.listen( 0, '127.0.0.1', resolve ).once( 'error', reject ) );
	const port = server.address().port;
	await new Promise( ( resolve, reject ) => server.close( error => error ? reject( error ) : resolve() ) );
	return port;
}

function startDaemon( binary, args ) {
	const child = spawn( binary, args, { stdio: [ 'ignore', 'pipe', 'pipe' ], env: { ...process.env, ...goBuildEnvironment() } } );
	child.output = '';
	child.stdout.setEncoding( 'utf8' ).on( 'data', value => { child.output += value; } );
	child.stderr.setEncoding( 'utf8' ).on( 'data', value => { child.output += value; } );
	processes.push( child );
	return child;
}

async function waitForGateway( child, url ) {
	const deadline = Date.now() + 30000;
	while ( Date.now() < deadline ) {
		if ( child.exitCode !== null ) throw new Error( `worldd exited before readiness:\n${child.output}` );
		try {
			const response = await fetch( `${url}/healthz` );
			if ( response.ok ) return;
		} catch {}
		await new Promise( resolve => setTimeout( resolve, 100 ) );
	}
	throw new Error( `worldd gateway did not become ready:\n${child.output}` );
}

try {
	await mkdir( dataDir, { recursive: true, mode: 0o700 } );
	const daemonDir = path.join( projectRoot, 'server/worldd' );
	const binary = path.join( tempRoot, 'worldd' );
	run( 'go', [ 'build', '-o', binary, '.' ], { cwd: daemonDir, env: goBuildEnvironment() } );
	const ownerPeerID = run( binary, [ '--data', dataDir, '--print-node-id' ] );
	const unsigned = path.join( tempRoot, 'world.unsigned.json' );
	const signed = path.join( tempRoot, 'world.signed.json' );
	run( process.execPath, [ path.join( projectRoot, 'tools/world-source-to-manifest.mjs' ), '--source', path.join( tidewaterRoot, 'world-source.json' ), '--owner', ownerPeerID, '--assets', path.join( tidewaterRoot, 'assets' ), '--out', unsigned ] );
	run( binary, [ '--data', dataDir, '--sign-manifest', unsigned, '--manifest-out', signed ] );
	const manifest = JSON.parse( await readFile( signed, 'utf8' ) ).payload;
	const port = await unusedPort();
	const gateway = `http://127.0.0.1:${port}`;
	const worldd = startDaemon( binary, [ '--data', dataDir, '--manifest', signed, '--asset-source', path.join( tidewaterRoot, 'assets' ), '--p2p-port', '0', '--http', `127.0.0.1:${port}`, '--dht-mode', 'server' ] );
	await waitForGateway( worldd, gateway );

	const source = JSON.parse( await readFile( path.join( tidewaterRoot, 'world-source.json' ), 'utf8' ) );
	const terrain = new TerrainData( { worldLayout: TIDEWATER_LAYOUT } );
	const input = { moveAxes: () => ( { x: 0, y: 1, sprint: 0 } ), consumeLook: () => ( { x: 0, y: 0 } ), down: () => false, hit: () => false };
	const player = new Player( {
		camera: new E.PerspectiveCamera( 60, 1, 0.1, 1000 ), input, terrain, colliders: tidewaterPierColliders( terrain ),
		query: { allocate: () => 0, setPoint() {}, cpuValid: false }, boat: null, worldLayout: TIDEWATER_LAYOUT,
	} );
	setMovementSupportKernel( null );
	player.setWorldRules( source.rules, { avatarProfileId: 'elsemesh.avatar.stock-male/1' } );
	player.setHostedWorldPose( { x: source.spawn.position[ 0 ], y: source.spawn.position[ 1 ], z: source.spawn.position[ 2 ] }, source.spawn.yaw, source.spawn.pitch );
	player.grounded = true;

	sourceConnector = new WorldConnector( { worldId: manifest.worldId, nodeId: ownerPeerID, gateway } );
	await sourceConnector.getManifest();
	session = new WorldPresenceSession( { connector: sourceConnector, parent: { add() {} }, onError: error => { throw error; } } );
	const spawnPose = player.position.toArray();
	await session.admit( player, [ spawnPose ] );
	assert.deepEqual( session.lastAcceptedPose.position, spawnPose, 'worldd admits Tidewater at its authored spawn' );

	for ( let frame = 0; frame < 360; frame ++ ) {
		player.updateHostedWorld( 1 / 60 );
		session.update( 1 / 60, player );
		await new Promise( resolve => setTimeout( resolve, 16 ) );
	}
	if ( session.pending ) await session.pending;
	assert.ok( ! session.lastRejectedPose || /presence_rate_limited/.test( session.lastRejectedPose.error ), `valid hosted movement was rejected by worldd: ${session.lastRejectedPose?.error || ''}` );
	assert.equal( player.worldMovementAuthorityBlocked, false, 'valid hosted movement never arms authority rollback' );
	assert.ok( player.position.z > - 60, 'the presence-backed player walks up the authored harbor steps onto the wooden deck' );
	assert.ok( Math.abs( player.position.y - TIDEWATER_LAYOUT.pier.deckHeight ) < 1e-6, 'the presence-backed player ends at the authored deck height' );
	assert.ok( Math.abs( session.lastAcceptedPose.position[ 2 ] - player.position.z ) < 0.5, 'the final server-accepted pose tracks local prediction without a visible rollback' );
	console.log( `Tidewater worldd presence accepted the 6-second hosted pier route: local=${player.position.toArray().map( v => v.toFixed( 3 )).join( ',' )}, accepted=${session.lastAcceptedPose.position.map( v => v.toFixed( 3 )).join( ',' )}` );
} finally {
	session?.dispose();
	sourceConnector?.close();
	for ( const child of processes.reverse() ) {
		if ( child.exitCode === null && child.signalCode === null ) {
			child.kill( 'SIGTERM' );
			await Promise.race( [ new Promise( resolve => child.once( 'exit', resolve ) ), new Promise( resolve => setTimeout( resolve, 2000 ) ) ] );
			if ( child.exitCode === null && child.signalCode === null ) child.kill( 'SIGKILL' );
		}
	}
	await rm( tempRoot, { recursive: true, force: true } );
}
