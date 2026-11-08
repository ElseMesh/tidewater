import assert from 'node:assert/strict';
import { accessSync, constants, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { createServer } from 'vite';

const engineRoot = process.cwd();
const sleep = ms => new Promise( resolve => setTimeout( resolve, ms ) );
function chromiumPath() {
	if ( process.env.ELSEMESH_TEST_CHROMIUM ) return process.env.ELSEMESH_TEST_CHROMIUM;
	for ( const name of [ 'chromium', 'chromium-browser', 'google-chrome' ] ) for ( const directory of ( process.env.PATH || '' ).split( ':' ) ) {
		const candidate = join( directory, name );
		try { accessSync( candidate, constants.X_OK ); return candidate; } catch {}
	}
	throw new Error( 'Chromium is required; set ELSEMESH_TEST_CHROMIUM to its executable path' );
}
async function stopBrowser( browser ) {
	try { process.kill( - browser.pid, 'SIGTERM' ); } catch {}
	await Promise.race( [ new Promise( resolve => browser.once( 'close', resolve ) ), sleep( 1000 ) ] );
	try { process.kill( - browser.pid, 'SIGKILL' ); } catch {}
}

const profile = mkdtempSync( join( '/var/tmp', 'tidewater-village-graphs-webgl-' ) );
const source = JSON.parse( readFileSync( join( engineRoot, 'worlds/tidewater/world-source.json' ), 'utf8' ) );
const village = source.objects.find( object => object.id === 'elsemesh-object:island-village' );
assert( village?.assetId?.startsWith( 'sha256:' ), 'signed Tidewater source identifies the village GLB' );
const villageBytes = readFileSync( join( engineRoot, 'worlds/tidewater/assets', village.assetId.slice( 'sha256:'.length ) ) );
const villageAssetPlugin = {
	name: 'tidewater-village-net-test-asset',
	configureServer( server ) {
		server.middlewares.use( '/__tidewater/village.glb', ( _request, response ) => {
			response.statusCode = 200;
			response.setHeader( 'Content-Type', 'model/gltf-binary' );
			response.setHeader( 'Content-Length', villageBytes.length );
			response.end( villageBytes );
		} );
	},
};
const vite = await createServer( { configFile: false, root: engineRoot, optimizeDeps: { entries: [ 'worlds/tidewater/test/village-net-webgl-render.html' ] }, plugins: [ villageAssetPlugin ], server: { host: '127.0.0.1', port: 0, strictPort: true }, appType: 'mpa' } );
let browser, socket;
try {
	await vite.listen();
	const address = vite.httpServer.address();
	assert( address && typeof address === 'object' && address.port > 0, 'Vite exposes an ephemeral localhost port' );
	browser = spawn( chromiumPath(), [
		'--headless=new', '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist',
		'--disable-dev-shm-usage', '--disable-extensions', '--no-first-run', '--no-default-browser-check',
		'--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--remote-allow-origins=*', `--user-data-dir=${profile}`, 'about:blank',
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
	socket = new WebSocket( page.webSocketDebuggerUrl );
	await new Promise( ( resolve, reject ) => {
		socket.addEventListener( 'open', resolve, { once: true } );
		socket.addEventListener( 'error', reject, { once: true } );
	} );
	let requestID = 0;
	const pending = new Map();
	socket.addEventListener( 'message', ( { data } ) => {
		const message = JSON.parse( data ), request = pending.get( message.id );
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
	await command( 'Page.enable' );
	await command( 'Runtime.enable' );
	await command( 'Page.navigate', { url: `http://127.0.0.1:${address.port}/worlds/tidewater/test/village-net-webgl-render.html` } );
	const deadline = Date.now() + 60000;
	let result;
	while ( Date.now() < deadline ) {
		const response = await command( 'Runtime.evaluate', { expression: "({status: document.querySelector('#result')?.dataset.status, text: document.querySelector('#result')?.textContent})", returnByValue: true } );
		result = response.result?.value;
		if ( result?.status === 'complete' || result?.status === 'failed' ) break;
		await sleep( 50 );
	}
	assert.equal( result?.status, 'complete', `Tidewater WebGL village graph render completed: ${result?.text || 'no page result'}` );
	const metrics = JSON.parse( result.text );
	assert( metrics.net >= 30 && metrics.hard >= 30 && metrics.thatch >= 30 && metrics.fabric >= 5 && metrics.stone >= 30 && metrics.roofMetal >= 30 && metrics.glass >= 30 && metrics.lanternGlass >= 10, `signed Tidewater net/hard/thatch/fabric/stone/roof-metal/glass graphs render visible pixels (${metrics.net}/${metrics.hard}/${metrics.thatch}/${metrics.fabric}/${metrics.stone}/${metrics.roofMetal}/${metrics.glass}/${metrics.lanternGlass})` );
	assert( metrics.programs > 0, 'WebGL compiled the signed Tidewater graph shaders' );
	assert.equal( metrics.glError, 0, 'WebGL reports no graphics error' );
	console.log( `Tidewater WebGL net/hard/thatch/fabric/stone/roof-metal/glass/lantern-glass graph render passed (${metrics.net}/${metrics.hard}/${metrics.thatch}/${metrics.fabric}/${metrics.stone}/${metrics.roofMetal}/${metrics.glass}/${metrics.lanternGlass} visible pixels; ${metrics.programs} program(s); no GL errors)` );
} finally {
	socket?.close();
	if ( browser ) await stopBrowser( browser );
	await vite.close();
	rmSync( profile, { recursive: true, force: true } );
}
