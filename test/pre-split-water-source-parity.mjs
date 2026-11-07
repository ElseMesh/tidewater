import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { TIDEWATER_LAYOUT } from '../layout.js';

const hash = source => createHash( 'sha256' ).update( source ).digest( 'hex' );
const sourceAt = path => readFile( new URL( path, import.meta.url ) );

export async function assertPreSplitWaterSource() {

	const wake = ( await sourceAt( '../../../src/ocean/WakeSim.js' ) ).toString()
		// Wake constants were extracted and diagnostic texture readback was enabled
		// after the split; normalize those mechanical changes to pin the solver.
		.replace( "import { WAKE_GRID_SIZE as N, WAKE_LOG2_SIZE as LOG2N, WAKE_HALF_SIZE as HALF, WAKE_GRID_MASK as MASK, WAKE_CELL_SIZE as CELL, WAKE_DOMAIN_SIZE as SIZE, WAKE_DEPTH_LEVELS as DEPTHS, WAKE_SPONGE_CELLS as SPONGE, WAKE_NEAR_FIELD } from './WakeConstants.js';\n", "\nconst N = 512; // grid cells per side\nconst LOG2N = 9;\nconst HALF = N / 2;\nconst MASK = N - 1;\nconst CELL = 0.4; // m\nconst SIZE = N * CELL; // window size (m)\n// reference depths of the four spectral operators (m); a cell blends the two bracketing its depth\nconst DEPTHS = [ Infinity, 6, 1.8, 0.6 ];\nconst SPONGE = 22; // absorbing band at the window edges (cells)" )
		.replace( "const { width: TW, height: TH, x0: TX0, x1: TX1, z0: TZ0, z1: TZ1 } = WAKE_NEAR_FIELD; // 0.1 m texels (steep pressure near the stem: keep resampling errors small)", "const TW = 32, TH = 88; // 0.1 m texels (steep pressure near the stem: keep resampling errors small)\nconst TX0 = - 1.6, TX1 = 1.6, TZ0 = - 4.4, TZ1 = 4.4;" )
		.replaceAll( ", 'copySrc'", '' );
	assert.equal( hash( wake ), '6ef224a6d6429511dfd7ea253f54f51fa9dac7d504b60f32518f9474a5461446', 'WakeSim physics/readers match pre-split source 23c30bf after normalizing extracted constants and diagnostic readback' );
	assert.equal( hash( await sourceAt( '../../../src/ocean/WaterQuery.js' ) ), '6d00c2638c137bf763782c1930477b7a09c94ef4dac08f980200eabb9f46bf76', 'WebGPU WaterQuery matches pre-split source 23c30bf' );
	assert.equal( hash( await sourceAt( '../../../src/world/boat/BoatDesign.js' ) ), '7b29270c6eb6defcd8a600ce49d4dadf0ae53e5a28c443d682850af4c6c18aa6', 'boat design matches pre-split source 23c30bf' );

	const controller = ( await sourceAt( '../../../src/player/BoatController.js' ) ).toString()
		// The controller's intentional baseline difference is accepting the dock
		// position from its world caller instead of importing Tidewater layout.
		.replace( "import { MathUtils, Quaternion, Vector3 } from '../engine/math/index.js';\n", "import { MathUtils, Quaternion, Vector3 } from '../engine/math/index.js';\nimport { ISLAND_DEFINITION } from '../world/IslandDefinition.js';\n" )
		.replace( "\tconstructor( { design, query, terrain, colliders, initialPosition, initialHeading = 0 } ) {\n\t\tif ( ! initialPosition || ! [ initialPosition.x, initialPosition.y, initialPosition.z ].every( Number.isFinite ) ) throw new Error( 'BoatController requires an explicit initialPosition from its world caller' );\n", "\tconstructor( { design, query, terrain, colliders, initialPosition = new Vector3( ...ISLAND_DEFINITION.boatDock.position ), initialHeading = ISLAND_DEFINITION.boatDock.heading } ) {\n" )
		.replace( '// The world supplies its berth; this reusable physics model has no default location.', '// Each world supplies its own berth. Defaults preserve the built-in island placement.' );
	assert.equal( hash( controller ), 'c96e7243b2858144845897eebf571ad5d894a7fa15200ca7a2c0ebea02a011dd', 'boat physics matches pre-split source 23c30bf after normalizing its world-supplied berth' );

	assert.deepEqual( [ TIDEWATER_LAYOUT.boatDock.position.x, TIDEWATER_LAYOUT.boatDock.position.y, TIDEWATER_LAYOUT.boatDock.position.z ], [ 64.5, 0, 36.5 ], 'Tidewater retains the pre-split boat berth' );
	assert.equal( TIDEWATER_LAYOUT.boatDock.heading, 0, 'Tidewater retains the pre-split boat heading' );
	assert.deepEqual( TIDEWATER_LAYOUT.pier, { x: 55, zStart: - 64, zEnd: 40, deckHeight: 2.3, width: 2.6, headWidth: 14, headDepth: 7 }, 'Tidewater retains the pre-split pier collider layout' );
	console.log( 'pre-split WebGPU wake, water-query, boat, dock, and pier source parity: ok' );

}
