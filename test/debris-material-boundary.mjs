import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Color } from '../../../src/engine/math/Color.js';
import { C, HARD, WOOD, lin, mulc } from '../debris/MaterialData.js';

const shapeSource = readFileSync( new URL( '../debris/DebrisShapes.js', import.meta.url ), 'utf8' );
assert.doesNotMatch( shapeSource, /src\/world\/Props\.js/, 'Tidewater debris no longer imports engine-world material and buoy content' );
assert.match( shapeSource, /src\/engine\/geometry\/ProceduralGeometry\.js/, 'Tidewater debris uses engine-owned generic geometry primitives' );
assert.doesNotMatch( shapeSource, /src\/world\/village\/GeoBuilder\.js/, 'Tidewater debris does not depend on the engine village builder' );
assert.deepEqual( WOOD( 0.25, 0.95, 1, 2 ), [ 0.25, 1, 2, 0.95 ], 'Tidewater keeps the same packed wood material data' );
assert.deepEqual( HARD( 0.5, 0.2, 0.6, 0.4 ), [ 0.5, 0.2, 0.6, 0.4 ], 'Tidewater keeps the same packed hard-material data' );
assert.deepEqual( mulc( [ 1, 2, 3 ], 1.5 ), [ 1.5, 3, 4.5 ], 'Tidewater color multiplication preserves the original channel math' );

const color = new Color().setHex( 0xe8622a );
assert.deepEqual( lin( 0xe8622a ), [ color.r, color.g, color.b ], 'the Tidewater palette uses the engine color-space conversion' );
assert.deepEqual( C.orange, lin( 0xe8622a ), 'the world owns its shoreline float color' );

console.log( 'Tidewater debris material and engine-content boundary passed' );
