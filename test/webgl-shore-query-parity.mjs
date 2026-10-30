import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { accessSync, constants, createReadStream, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const testDirectory = dirname( fileURLToPath( import.meta.url ) );
const engineRoot = resolve( testDirectory, '../../..' );
const referencePath = join( testDirectory, 'webgpu-shore-query-reference.json' );

function chromiumPath() {
	if ( process.env.ELSEMESH_TEST_CHROMIUM ) return process.env.ELSEMESH_TEST_CHROMIUM;
	for ( const name of [ 'chromium', 'chromium-browser', 'google-chrome' ] ) {
		for ( const directory of ( process.env.PATH || '' ).split( ':' ) ) {
			const candidate = join( directory, name );
			try { accessSync( candidate, constants.X_OK ); return candidate; } catch {}
		}
	}
	throw new Error( 'Chromium is required; set ELSEMESH_TEST_CHROMIUM to its executable path' );
}

const sleep = ms => new Promise( resolve => setTimeout( resolve, ms ) );
async function stopBrowser( browser ) {
	try { process.kill( - browser.pid, 'SIGTERM' ); } catch {}
	await Promise.race( [ new Promise( resolve => browser.once( 'close', resolve ) ), sleep( 1000 ) ] );
	try { process.kill( - browser.pid, 'SIGKILL' ); } catch {}
}

const writer = spawnSync( process.execPath, [ '--preserve-symlinks', join( testDirectory, 'write-webgpu-shore-query-reference.mjs' ) ], {
	cwd: engineRoot, encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024,
	env: { ...process.env, ELSEMESH_SHORE_QUERY_REFERENCE: referencePath },
} );
if ( writer.error ) throw writer.error;
assert.equal( writer.status, 0, `headless Dawn builds the WebGPU reference: ${writer.stdout}\n${writer.stderr}` );
process.stdout.write( writer.stdout );

const profile = mkdtempSync( join( '/var/tmp', 'elsemesh-tidewater-shore-parity-' ) );
const vite = await createServer( {
	configFile: false, root: engineRoot, server: { host: '127.0.0.1', port: 0, strictPort: true }, appType: 'mpa',
	plugins: [ {
		name: 'serve-tidewater-binary-test-assets',
		configureServer( server ) {
			server.middlewares.use( ( request, response, next ) => {
				const pathname = new URL( request.url, 'http://127.0.0.1' ).pathname;
				const match = /^\/worlds\/tidewater\/assets\/([a-f0-9]{64})$/.exec( pathname );
				if ( ! match ) return next();
				response.setHeader( 'Content-Type', 'application/octet-stream' );
				createReadStream( join( engineRoot, 'worlds/tidewater/assets', match[ 1 ] ) ).on( 'error', next ).pipe( response );
			} );
		},
	} ],
} );
let browser;
try {
	await vite.listen();
	const address = vite.httpServer.address();
	assert( address && typeof address === 'object' && address.port > 0, 'Vite exposes an ephemeral localhost port' );
	const url = `http://127.0.0.1:${address.port}/worlds/tidewater/test/webgl-shore-query-parity.html`;
	browser = spawn( chromiumPath(), [
		'--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-extensions',
		'--no-first-run', '--no-default-browser-check', '--remote-debugging-address=127.0.0.1',
		'--remote-debugging-port=0', '--remote-allow-origins=*', `--user-data-dir=${profile}`, 'about:blank',
	], { detached: true, stdio: 'ignore' } );
	const activePort = join( profile, 'DevToolsActivePort' ), startDeadline = Date.now() + 10000;
	while ( ! existsSync( activePort ) && Date.now() < startDeadline ) {
		if ( browser.exitCode !== null ) throw new Error( `isolated Chromium exited early (${browser.exitCode})` );
		await sleep( 50 );
	}
	assert( existsSync( activePort ), 'isolated Chromium starts its DevTools endpoint' );
	const [ port ] = readFileSync( activePort, 'utf8' ).trim().split( /\r?\n/ );
	const targetsResponse = await fetch( `http://127.0.0.1:${port}/json/list` );
	assert.equal( targetsResponse.ok, true );
	const page = ( await targetsResponse.json() ).find( target => target.type === 'page' && target.webSocketDebuggerUrl );
	assert( page, 'isolated Chromium exposes its page target' );
	const socket = new WebSocket( page.webSocketDebuggerUrl );
	await new Promise( ( resolve, reject ) => {
		socket.addEventListener( 'open', resolve, { once: true } );
		socket.addEventListener( 'error', reject, { once: true } );
	} );
	let requestID = 0;
	const pending = new Map();
	socket.addEventListener( 'message', ( { data } ) => {
		const message = JSON.parse( data );
		const request = pending.get( message.id );
		if ( ! request ) return;
		pending.delete( message.id );
		if ( message.error ) request.reject( new Error( message.error.message ) );
		else request.resolve( message.result );
	} );
	const command = ( method, params = {} ) => new Promise( ( resolve, reject ) => {
		const id = ++ requestID;
		pending.set( id, { resolve, reject } );
		socket.send( JSON.stringify( { id, method, params } ) );
	} );
	try {
		await command( 'Page.enable' );
		await command( 'Runtime.enable' );
		await command( 'Page.navigate', { url } );
		const deadline = Date.now() + 30000;
		let result;
		while ( Date.now() < deadline ) {
			const response = await command( 'Runtime.evaluate', {
				expression: "({status: document.querySelector('#result')?.dataset.status, text: document.querySelector('#result')?.textContent})",
				returnByValue: true,
			} );
			result = response.result?.value;
			if ( result?.status === 'complete' || result?.status === 'failed' ) break;
			await sleep( 50 );
		}
		assert.equal( result?.status, 'complete', `WebGL shoreline query completed: ${result?.text || 'no page result'}` );
		const metrics = JSON.parse( result.text );
		assert.equal( metrics.status, 'complete' );
		assert( [ metrics.heightError, metrics.maxHeightError, metrics.normalError, metrics.floorError ].every( Number.isFinite ), 'query parity metrics are finite' );
		assert( metrics.heightError <= 0.04, `Tidewater WebGL shoreline height MAE ${metrics.heightError} m <= 0.04 m` );
		assert( metrics.maxHeightError <= 0.11, `Tidewater WebGL shoreline max height error ${metrics.maxHeightError} m <= 0.11 m` );
		assert( metrics.normalError <= 0.01, `Tidewater WebGL shoreline normal MAE ${metrics.normalError} <= 0.01` );
		assert( metrics.floorError <= 1e-5, `Tidewater WebGL terrain floor MAE ${metrics.floorError} m <= 1e-5 m` );
		console.log( `Tidewater shoreline query parity passed (${metrics.count} packaged-terrain points; height MAE ${metrics.heightError.toFixed(4)} m, max ${metrics.maxHeightError.toFixed(4)} m; normal MAE ${metrics.normalError.toFixed(4)}; floor MAE ${metrics.floorError.toExponential(1)} m)` );
	} finally {
		socket.close();
	}
} finally {
	if ( browser ) await stopBrowser( browser );
	await vite.close();
	rmSync( profile, { recursive: true, force: true } );
	rmSync( referencePath, { force: true } );
}
