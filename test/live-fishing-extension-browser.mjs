import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { accessSync, constants, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { goBuildEnvironment } from '../../../test/go-build-env.mjs';

const tidewaterRoot = resolve( dirname( fileURLToPath( import.meta.url ) ), '..' );
const engineRoot = resolve( tidewaterRoot, '../..' );
const temporaryRoot = mkdtempSync( join( '/var/tmp', 'tidewater-live-fishing-' ) );
const browserProfile = mkdtempSync( join( '/var/tmp', 'tidewater-live-fishing-chromium-' ) );
const processes = [];
let browserProcess = null;
let vite;

function chromiumPath() {
	if ( process.env.ELSEMESH_TEST_CHROMIUM ) return process.env.ELSEMESH_TEST_CHROMIUM;
	for ( const executable of [ 'chromium', 'chromium-browser', 'google-chrome' ] ) {
		for ( const directory of ( process.env.PATH || '' ).split( ':' ) ) {
			const candidate = join( directory, executable );
			try { accessSync( candidate, constants.X_OK ); return candidate; } catch {}
		}
	}
	throw new Error( 'Chromium is required; set ELSEMESH_TEST_CHROMIUM to its executable path' );
}

function run( command, args, options = {} ) {
	const result = spawnSync( command, args, { encoding: 'utf8', ...options } );
	if ( result.error ) throw result.error;
	assert.equal( result.status, 0, `${command} ${args.join( ' ' )} failed:\n${result.stdout}\n${result.stderr}` );
	return result.stdout.trim();
}

function start( command, args, options = {} ) {
	const child = spawn( command, args, { stdio: [ 'ignore', 'pipe', 'pipe' ], ...options } );
	child.output = '';
	for ( const stream of [ child.stdout, child.stderr ] ) stream.setEncoding( 'utf8' ).on( 'data', value => { child.output += value; } );
	processes.push( child );
	return child;
}

async function waitFor( condition, label, child = null ) {
	const deadline = Date.now() + 30000;
	while ( Date.now() < deadline ) {
		if ( child ) assert.equal( child.exitCode, null, `${label}: process exited\n${child.output}` );
		const value = await condition();
		if ( value ) return value;
		await new Promise( resolve => setTimeout( resolve, 100 ) );
	}
	assert.fail( `Timed out waiting for ${label}${child ? `:\n${child.output}` : ''}` );
}

async function launchBrowser( url ) {
	const child = spawn( chromiumPath(), [
		'--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-extensions',
		'--no-first-run', '--no-default-browser-check', '--remote-debugging-address=127.0.0.1',
		'--remote-debugging-port=0', '--remote-allow-origins=*', `--user-data-dir=${browserProfile}`, 'about:blank',
	], { detached: true, stdio: 'ignore' } );
	try {
		const activePort = join( browserProfile, 'DevToolsActivePort' );
		await waitFor( () => existsSync( activePort ), 'isolated Chromium DevTools endpoint', child );
		const [ port ] = readFileSync( activePort, 'utf8' ).trim().split( /\r?\n/ );
		const targets = await ( await fetch( `http://127.0.0.1:${port}/json/list` ) ).json();
		const page = targets.find( target => target.type === 'page' && target.webSocketDebuggerUrl );
		assert( page, 'Isolated Chromium exposes a page target' );
		return { child, page };
	} catch ( error ) {
		await stopGroup( child );
		throw error;
	}
}

async function inspectPage( page, url ) {
	const socket = new WebSocket( page.webSocketDebuggerUrl );
	await new Promise( ( resolve, reject ) => {
		socket.addEventListener( 'open', resolve, { once: true } );
		socket.addEventListener( 'error', reject, { once: true } );
	} );
	let nextID = 0;
	const pending = new Map();
	socket.addEventListener( 'message', ( { data } ) => {
		const message = JSON.parse( data );
		const request = pending.get( message.id );
		if ( ! request ) return;
		pending.delete( message.id );
		message.error ? request.reject( new Error( message.error.message ) ) : request.resolve( message.result );
	} );
	const command = ( method, params = {} ) => new Promise( ( resolve, reject ) => {
		const id = ++ nextID;
		pending.set( id, { resolve, reject } );
		socket.send( JSON.stringify( { id, method, params } ) );
	} );
	try {
		await command( 'Page.enable' );
		await command( 'Runtime.enable' );
		await command( 'Page.navigate', { url } );
		const deadline = Date.now() + 30000;
		while ( Date.now() < deadline ) {
			const state = await command( 'Runtime.evaluate', { expression: "({status: document.querySelector('#result')?.dataset.status, text: document.querySelector('#result')?.textContent})", returnByValue: true } );
			const value = state.result?.value;
			if ( value?.status === 'passed' || value?.status === 'failed' ) return value;
			await new Promise( resolve => setTimeout( resolve, 50 ) );
		}
		throw new Error( 'Live Tidewater Worker integration did not complete within 30 seconds' );
	} finally {
		socket.close();
	}
}

async function stopGroup( child ) {
	if ( ! child || child.exitCode !== null ) return;
	try { process.kill( - child.pid, 'SIGTERM' ); } catch {}
	await Promise.race( [ new Promise( resolve => child.once( 'close', resolve ) ), new Promise( resolve => setTimeout( resolve, 1500 ) ) ] );
	try { process.kill( - child.pid, 'SIGKILL' ); } catch {}
}

async function stopDaemon( child ) {
	if ( ! child || child.exitCode !== null ) return;
	child.kill( 'SIGTERM' );
	await Promise.race( [ new Promise( resolve => child.once( 'exit', resolve ) ), new Promise( resolve => setTimeout( resolve, 5000 ) ) ] );
	if ( child.exitCode === null ) child.kill( 'SIGKILL' );
}

try {
	const worldSource = JSON.parse( readFileSync( join( tidewaterRoot, 'world-source.json' ), 'utf8' ) );
	const behaviorId = 'elsemesh.fishing-game/1';
	const reference = worldSource.experience.extensions.find( item => item.behaviorId === behaviorId );
	assert( reference, 'Tidewater world source declares its fishing extension' );
	const modulePath = join( tidewaterRoot, 'extensions', 'fishing-game-rules.js' );
	const moduleBytes = readFileSync( modulePath );
	assert.equal( `sha256:${createHash( 'sha256' ).update( moduleBytes ).digest( 'hex' )}`, reference.assetId, 'test serves the exact extension named by Tidewater world source' );

	const binary = join( temporaryRoot, 'worldd' );
	const build = spawnSync( 'go', [ 'build', '-o', binary, '.' ], { cwd: join( engineRoot, 'server', 'worldd' ), encoding: 'utf8', timeout: 180000, env: goBuildEnvironment() } );
	assert.equal( build.status, 0, `worldd build failed:\n${build.stdout}\n${build.stderr}` );
	const data = join( temporaryRoot, 'worldd-data' );
	const ownerPeerId = run( binary, [ '--data', data, '--print-node-id' ] );
	const assetId = run( binary, [ '--data', data, '--import-asset', modulePath ] );
	assert.equal( assetId, reference.assetId, 'worldd imports the extension under its authored SHA-256 ID' );
	const unsignedPath = join( temporaryRoot, 'world-unsigned.json' );
	const signedPath = join( temporaryRoot, 'world-signed.json' );
	writeFileSync( unsignedPath, JSON.stringify( {
		protocol: 'elsemesh.world/3', worldId: worldSource.worldId, ownerPeerId, authorityPeerId: ownerPeerId, authorityEpoch: 1,
		version: 1, discoverable: false, title: worldSource.title,
		rules: worldSource.rules,
		assets: [ { id: assetId, bytes: moduleBytes.byteLength, kind: 'javascript/1', priority: 'visible' } ],
		objects: [], components: [], portals: [], hosts: [], experience: worldSource.experience,
		updatedAt: Math.floor( Date.now() / 1000 ),
	} ), { mode: 0o600 } );
	run( binary, [ '--data', data, '--sign-manifest', unsignedPath, '--manifest-out', signedPath ] );

	vite = await createServer( { configFile: false, root: engineRoot, optimizeDeps: { entries: [ 'worlds/tidewater/test/live-fishing-extension-browser.html' ] }, server: { host: '127.0.0.1', port: 0, strictPort: true }, appType: 'mpa' } );
	await vite.listen();
	const viteAddress = vite.httpServer.address();
	assert( viteAddress && typeof viteAddress === 'object' && viteAddress.port > 0, 'Vite exposes an ephemeral browser-test port' );
	const origin = `http://127.0.0.1:${viteAddress.port}`;
	const daemon = start( binary, [ '--data', data, '--manifest', signedPath, '--p2p-port', '0', '--zerotier-network', '', '--http', '127.0.0.1:0', '--dht-mode', 'client', '--allow-browser-origin', origin ] );
	const gatewayPort = await waitFor( async () => {
		const match = daemon.output.match( /http=127\.0\.0\.1:(\d+)/ );
		if ( ! match ) return null;
		try { return ( await fetch( `http://127.0.0.1:${match[ 1 ]}/healthz` ) ).ok ? Number( match[ 1 ] ) : null; } catch { return null; }
	}, 'worldd live gateway', daemon );
	const url = new URL( '/worlds/tidewater/test/live-fishing-extension-browser.html', origin );
	url.searchParams.set( 'worldId', worldSource.worldId );
	url.searchParams.set( 'nodeId', ownerPeerId );
	url.searchParams.set( 'gateway', `http://127.0.0.1:${gatewayPort}` );
	const browser = await launchBrowser( url.href );
	browserProcess = browser.child;
	const result = await inspectPage( browser.page, url.href );
	assert.equal( result.status, 'passed', `live Tidewater fishing extension passed: ${result.text}` );
	assert.match( result.text, /signed Tidewater module through gateway and dedicated Workers via registered WebGPU\/WebGL frame hooks; WebGPU App activation, gameplay frames, departure, and re-entry/ );
	console.log( 'Tidewater fishing parity: signed manifest, live WebGPU App activation/gameplay/departure/re-entry, WebGL hooks, and dedicated Workers passed' );
} finally {
	if ( browserProcess ) await stopGroup( browserProcess );
	for ( const child of processes.reverse() ) await stopDaemon( child );
	if ( vite ) await vite.close();
	rmSync( browserProfile, { recursive: true, force: true } );
	rmSync( temporaryRoot, { recursive: true, force: true } );
}
