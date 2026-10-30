import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { BoatController } from '../../../src/player/BoatController.js';
import { ISLAND_DEFINITION } from '../../../src/world/IslandDefinition.js';
import { BoatDesign } from '../../../src/world/boat/BoatDesign.js';
import { Vector3 } from '../../../src/engine/math/Vector3.js';
import { Group } from '../../../src/engine/scene/Group.js';
import { HostedBoat } from '../../../src/network/HostedBoat.js';
import { worldWaterSurfaceFor } from '../../../src/network/WorldWaterSurface.js';
import { tidewaterComponentInstaller } from '../component-installers.js';

// The pre-split BoatController and boat design are the physics baseline. Their
// source is intentionally pinned here: the hosted boat must retain the same
// integrator while receiving water samples from its own world.
const BASELINE_CONTROLLER_SHA256 = 'c96e7243b2858144845897eebf571ad5d894a7fa15200ca7a2c0ebea02a011dd';
const BASELINE_DESIGN_SHA256 = '7b29270c6eb6defcd8a600ce49d4dadf0ae53e5a28c443d682850af4c6c18aa6';
const controllerSource = await readFile( new URL( '../../../src/player/BoatController.js', import.meta.url ) );
const designSource = await readFile( new URL( '../../../src/world/boat/BoatDesign.js', import.meta.url ) );
// Reconstruct the pre-split source around the intentionally world-agnostic
// constructor change. This keeps the physics implementation pinned byte for
// byte while allowing each world to supply its own berth.
const comparableControllerSource = controllerSource.toString()
	.replace(
		"import { MathUtils, Quaternion, Vector3 } from '../engine/math/index.js';\n",
		"import { MathUtils, Quaternion, Vector3 } from '../engine/math/index.js';\nimport { ISLAND_DEFINITION } from '../world/IslandDefinition.js';\n",
	)
	.replace(
		"\tconstructor( { design, query, terrain, colliders, initialPosition, initialHeading = 0 } ) {\n\t\tif ( ! initialPosition || ! [ initialPosition.x, initialPosition.y, initialPosition.z ].every( Number.isFinite ) ) throw new Error( 'BoatController requires an explicit initialPosition from its world caller' );\n",
		"\tconstructor( { design, query, terrain, colliders, initialPosition = new Vector3( ...ISLAND_DEFINITION.boatDock.position ), initialHeading = ISLAND_DEFINITION.boatDock.heading } ) {\n",
	)
	.replace( '// The world supplies its berth; this reusable physics model has no default location.', '// Each world supplies its own berth. Defaults preserve the built-in island placement.' );
assert.equal( createHash( 'sha256' ).update( comparableControllerSource ).digest( 'hex' ), BASELINE_CONTROLLER_SHA256, 'the boat physics implementation matches pre-split source 23c30bf after excluding the world berth constructor' );
assert.equal( createHash( 'sha256' ).update( designSource ).digest( 'hex' ), BASELINE_DESIGN_SHA256, 'the boat design matches pre-split source 23c30bf' );

const world = JSON.parse( await readFile( new URL( '../world-source.json', import.meta.url ), 'utf8' ) );
const berth = world.objects.find( object => object.id === 'elsemesh-object:moored-lobster-boat' );
assert.deepEqual( berth?.transform.position, ISLAND_DEFINITION.boatDock.position, 'the packaged Tidewater boat uses the original berth position' );
assert.equal( berth?.transform.yaw, ISLAND_DEFINITION.boatDock.heading, 'the packaged Tidewater boat uses the original berth heading' );

// The Tidewater ocean installer exposes the active world's surface, and the
// hosted boat keeps the query selected from that surface. App activation adds
// this world's terrain, shore, and wake to the surface before constructing it.
const worldSurface = { fft: {}, terrain: {}, shore: {}, wake: {}, shoreSim: {} };
const oceanRoot = new Group(), oceanComponents = [];
await tidewaterComponentInstaller( 'elsemesh.island-ocean/1' )( {
	app: { qs: new URLSearchParams(), surface: worldSurface, waterMaterial: {} },
	root: oceanRoot, installed: oceanComponents,
} );
const activeSurface = worldWaterSurfaceFor( oceanComponents, berth.transform.position, {} );
assert.equal( activeSurface, worldSurface, 'the active Tidewater ocean is selected for boat water queries' );
for ( const feature of [ 'fft', 'terrain', 'shore', 'wake', 'shoreSim' ] ) assert( activeSurface[ feature ], `the active water surface includes ${feature}` );
const boatQuery = { surface: activeSurface, allocate: () => 1 };
const boatRuntime = new HostedBoat( { root: new Group(), component: { id: 'elsemesh-component:boat' }, object: berth } );
assert.equal( boatRuntime.activate( { query: boatQuery, colliders: {} } ).query, boatQuery, 'the hosted boat controller receives the active world query' );
boatRuntime.dispose();
for ( const component of oceanComponents ) component.dispose?.();

class DeterministicQuery {

	constructor() {
		this.count = 1; // slot zero is the camera, as in WaterQuery
		this.inputs = new Float32Array( 64 * 4 );
		this.cpu = new Float32Array( 64 * 4 );
		this.resultInputs = new Float32Array( 64 * 4 );
		this.cpuValid = false;
		this.version = 0;
		this.resultTime = 0;
		this.latency = 0.05;
	}

	allocate( _name, count ) {
		const start = this.count;
		this.count += count;
		return start;
	}

	setPoint( index, x, z ) {
		this.inputs[ index * 4 ] = x;
		this.inputs[ index * 4 + 1 ] = z;
	}

}

// Deterministic FFT-like swell common to both synthetic query paths, plus small
// shoreline and interactive-wake terms. This sensitivity comparison quantifies
// the effect of omitting those terms; it does not model the production query
// wiring, which is asserted above and exercised in the hosted runtime.
function waterHeight( path, time, x, z ) {
	const fft = 0.045 * Math.sin( 0.09 * x + 0.13 * z - 1.1 * time ) + 0.025 * Math.sin( 0.035 * x - 0.07 * z + 0.8 * time );
	if ( path === 'fft-only' ) return fft;
	const shore = 0.10 * Math.exp( - ( ( ( z - 36 ) / 24 ) ** 2 ) ) * Math.sin( 0.18 * x + 0.21 * z - 1.8 * time );
	const wake = 0.045 * Math.exp( - ( ( x - 64.5 ) ** 2 + ( z - 32 ) ** 2 ) / 80 ) * Math.sin( 0.42 * x - 0.31 * z - 2.3 * time );
	return fft + shore + wake;
}

function simulate( queryPath, driven ) {
	const query = new DeterministicQuery();
	const design = new BoatDesign();
	const boat = new BoatController( {
		design, query, terrain: { heightAt: () => -100 }, colliders: { resolveCapsule: () => false },
		initialPosition: new Vector3( ...ISLAND_DEFINITION.boatDock.position ),
		initialHeading: ISLAND_DEFINITION.boatDock.heading,
	} );
	const trace = [];
	const dt = 1 / 60;
	for ( let frame = 0; frame < 18 * 60; frame ++ ) {
		const time = frame * dt;
		boat.queueQueries();
		query.resultInputs.set( query.inputs );
		query.cpu.fill( 0 );
		for ( let sample = 0; sample < design.hullSamples.length; sample ++ ) {
			const offset = ( boat.slot + sample ) * 4;
			const x = query.inputs[ offset ], z = query.inputs[ offset + 1 ];
			const sampleTime = time + query.latency, epsilon = 0.25;
			const h = waterHeight( queryPath, sampleTime, x, z );
			const gx = ( waterHeight( queryPath, sampleTime, x + epsilon, z ) - waterHeight( queryPath, sampleTime, x - epsilon, z ) ) / ( 2 * epsilon );
			const gz = ( waterHeight( queryPath, sampleTime, x, z + epsilon ) - waterHeight( queryPath, sampleTime, x, z - epsilon ) ) / ( 2 * epsilon );
			const normalLength = Math.hypot( gx, gz, 1 );
			query.cpu[ offset ] = h;
			query.cpu[ offset + 1 ] = - gx / normalLength;
			query.cpu[ offset + 2 ] = - gz / normalLength;
			query.cpu[ offset + 3 ] = -100;
		}
		query.cpuValid = true;
		query.resultTime = time;
		query.version ++;
		if ( driven && frame >= 8 * 60 ) {
			boat.driven = true;
			boat.setInput( 0.65, 0.2, dt );
		}
		boat.update( dt );
		if ( frame % 60 === 59 ) trace.push( {
			position: [ boat.position.x, boat.position.y, boat.position.z ],
			velocity: [ boat.velocity.x, boat.velocity.y, boat.velocity.z ],
			angular: [ boat.angular.x, boat.angular.y, boat.angular.z ],
			quaternion: [ boat.quaternion.x, boat.quaternion.y, boat.quaternion.z, boat.quaternion.w ],
			rpm: boat.rpm,
		} );
	}
	return trace;
}

const fullSurfaceReplayA = simulate( 'full', true );
const fullSurfaceReplayB = simulate( 'full', true );
assert.deepEqual( fullSurfaceReplayB, fullSurfaceReplayA, 'the same deterministic height/normal/terrain samples reproduce the pre-split boat trace exactly' );

const baselineRest = simulate( 'full', false );
const packagedRest = simulate( 'fft-only', false );
const baselineRun = fullSurfaceReplayA;
const packagedRun = simulate( 'fft-only', true );
const distance = ( left, right, field ) => Math.hypot( ...left[ field ].map( ( value, index ) => value - right[ field ][ index ] ) );
const restPositionDelta = distance( baselineRest[ 17 ], packagedRest[ 17 ], 'position' );
const restSpeedDelta = distance( baselineRest[ 17 ], packagedRest[ 17 ], 'velocity' );
const runPositionDelta = distance( baselineRun[ 17 ], packagedRun[ 17 ], 'position' );
const runSpeedDelta = distance( baselineRun[ 17 ], packagedRun[ 17 ], 'velocity' );

assert.ok( restPositionDelta > 0.05, `omitting shoreline/wake inputs changes rest position (${restPositionDelta.toFixed( 3 )} m)` );
assert.ok( restSpeedDelta > 0.15, `omitting shoreline/wake inputs changes rest velocity (${restSpeedDelta.toFixed( 3 )} m/s)` );
assert.ok( runPositionDelta > 0.4, `omitting shoreline/wake inputs changes throttle-run position (${runPositionDelta.toFixed( 3 )} m)` );
assert.ok( runSpeedDelta > 0.05, `omitting shoreline/wake inputs changes throttle-run speed (${runSpeedDelta.toFixed( 3 )} m/s)` );

console.log( `Boat water-query trace (18s): rest Δposition ${restPositionDelta.toFixed( 3 )}m / Δspeed ${restSpeedDelta.toFixed( 3 )}m/s; throttle Δposition ${runPositionDelta.toFixed( 3 )}m / Δspeed ${runSpeedDelta.toFixed( 3 )}m/s` );
