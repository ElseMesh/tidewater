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
	cwd: engineRoot, encoding: 'utf8', timeout: 600000, maxBuffer: 1024 * 1024,
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
		const deadline = Date.now() + 300000;
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
		console.log( `Tidewater shore hook vs WebGPU shore-only query: height MAE ${metrics.shoreProfile.shoreOffsetError.toFixed(4)} m, max ${metrics.shoreProfile.maxShoreOffsetError.toFixed(4)} m` );
		console.log( `Tidewater CPU shore profile vs direct WebGPU shoreEvaluate: height MAE ${metrics.shoreProfile.shorePointError.toFixed(4)} m, max ${metrics.shoreProfile.maxShorePointError.toFixed(4)} m` );
		assert( metrics.shoreProfile.shoreOffsetError <= 0.001 && metrics.shoreProfile.maxShoreOffsetError <= 0.002, 'Tidewater shore hook tracks Eulerian WebGPU shoreline within 2 mm' );
		assert( metrics.shoreProfile.shorePointError <= 0.0001 && metrics.shoreProfile.maxShorePointError <= 0.0001, 'Tidewater CPU shore profile matches direct WebGPU displacement within 0.1 mm' );
		assert( metrics.boat && Number.isFinite( metrics.boat.maxPositionDelta ) && Number.isFinite( metrics.boat.maxSpeedDelta ), 'production boat traces yield finite backend deltas' );
		assert( metrics.boat.maxPositionDelta <= 0.15, `18-second WebGPU/WebGL boat position delta ${metrics.boat.maxPositionDelta} m <= 0.15 m` );
		assert( metrics.boat.maxSpeedDelta <= 0.02, `18-second WebGPU/WebGL boat speed delta ${metrics.boat.maxSpeedDelta} m/s <= 0.02 m/s` );
		assert( metrics.boat.maxTraceWaterHeightError <= 0.02, `same-position production water height error ${metrics.boat.maxTraceWaterHeightError} m <= 0.02 m` );
		const peakPosition = metrics.boat.samples.reduce( ( peak, sample ) => sample.positionDelta > peak.positionDelta ? sample : peak );
		const finalBoat = metrics.boat.samples.at( - 1 );
		console.log( `Tidewater production boat trace (18 s, FFT + packaged shoreline, no interactive wake): max position delta ${metrics.boat.maxPositionDelta.toFixed(3)} m at ${peakPosition.second} s; final ${finalBoat.positionDelta.toFixed(3)} m; max speed delta ${metrics.boat.maxSpeedDelta.toFixed(3)} m/s` );
		console.log( `per-second position deltas (m): ${metrics.boat.samples.map( sample => sample.positionDelta.toFixed(2) ).join( ', ' )}` );
		console.log( 'second | position Δ | Δx | Δz | speed Δ | heading Δ° | point height Δ | point normal Δ | depth | WebGPU h | WebGL h' );
		for ( let i = 0; i < metrics.boat.samples.length; i ++ ) {
			const boat = metrics.boat.samples[ i ], water = metrics.boat.traceWaterSamples[ i ];
			const webgpuH = boat.webgpu.water[ 0 ], webglH = boat.webgl.water[ 0 ];
			const yaw = q => Math.atan2( 2 * ( q[ 3 ] * q[ 1 ] + q[ 0 ] * q[ 2 ] ), 1 - 2 * ( q[ 1 ] ** 2 + q[ 2 ] ** 2 ) );
			const headingDelta = Math.atan2( Math.sin( yaw( boat.webgl.quaternion ) - yaw( boat.webgpu.quaternion ) ), Math.cos( yaw( boat.webgl.quaternion ) - yaw( boat.webgpu.quaternion ) ) ) * 180 / Math.PI;
			const dx = boat.webgl.position[ 0 ] - boat.webgpu.position[ 0 ], dz = boat.webgl.position[ 2 ] - boat.webgpu.position[ 2 ];
			console.log( `${String( i + 1 ).padStart( 6 )} | ${boat.positionDelta.toFixed(3).padStart(11)} | ${dx.toFixed(3).padStart(6)} | ${dz.toFixed(3).padStart(6)} | ${boat.speedDelta.toFixed(3).padStart(7)} | ${headingDelta.toFixed(3).padStart(10)} | ${water.heightDelta.toFixed(4).padStart(14)} | ${water.normalDelta.toFixed(5).padStart(14)} | ${water.depth.toFixed(1).padStart(5)} | ${webgpuH.toFixed(3).padStart(8)} | ${webglH.toFixed(3).padStart(7)}` );
		}
		const worstWater = metrics.boat.traceWaterSamples.reduce( ( worst, sample ) => sample.heightDelta > worst.heightDelta ? sample : worst );
		console.log( `same-position/time water samples along the WebGPU trace: height MAE ${metrics.boat.traceWaterHeightError.toFixed(4)} m, max ${metrics.boat.maxTraceWaterHeightError.toFixed(4)} m; normal-vector MAE ${metrics.boat.traceWaterNormalError.toFixed(5)}` );
		console.log( `FFT-only same-position/time samples: height MAE ${metrics.boat.fftOnlyHeightError.toFixed(4)} m, max ${metrics.boat.maxFFTOnlyHeightError.toFixed(4)} m; normal-vector MAE ${metrics.boat.fftOnlyNormalError.toFixed(5)}` );
		console.log( `FFT-only per-second height deltas (m): ${metrics.boat.fftOnlySamples.map( sample => sample.heightDelta.toFixed(3) ).join( ', ' )}` );
		console.log( `largest fixed-point height error is ${worstWater.heightDelta.toFixed(4)} m at ${worstWater.second} s (depth ${worstWater.depth.toFixed(1)} m, x/z ${worstWater.point.map( value => value.toFixed(1) ).join('/')}); WebGPU ${worstWater.webgpu[0].toFixed(3)} m, WebGL ${worstWater.webgl[0].toFixed(3)} m` );
	} finally {
		socket.close();
	}
} finally {
	if ( browser ) await stopBrowser( browser );
	await vite.close();
	rmSync( profile, { recursive: true, force: true } );
	rmSync( referencePath, { force: true } );
}
