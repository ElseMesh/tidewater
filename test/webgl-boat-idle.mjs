import assert from 'node:assert/strict';
import { Vector3 } from '../../../src/engine/math/Vector3.js';
import { WebGLWaterQuery } from '../../../src/fallback/WebGLWaterQuery.js';
import { BoatController } from '../../../src/player/BoatController.js';
import { BoatDesign } from '../../../src/world/boat/BoatDesign.js';
import { IslandWorldState } from '../../../src/world/IslandWorldState.js';
import { computeShoreField } from '../../../src/world/ShoreField.js';
import '../register-behavior.js';
import { dispatchWorldBehaviorHooks } from '../../../src/network/WorldBehaviorRegistry.js';

const world = new IslandWorldState();
const shoreField = computeShoreField( world.terrain, { res: 512, swellDir: [ - 0.12, - 1 ], seaLevel: - 0.15 } );
const query = new WebGLWaterQuery( world.terrain, - 0.15 );
const experience = { behaviors: { 'elsemesh.shore-aware-boat/1': {} } };
dispatchWorldBehaviorHooks( experience, 'onWebGLWorldActivated', {
	fallback: { waterQuery: query, terrain: world.terrain, shoreField }, mode: 'builtin',
} );
query.update( 0, 3.25 );
const x = 72.4, z = 31.8, t = query.time;
const expectedBase = query.seaLevel
	+ 0.95 * Math.sin( x * 0.035 + z * 0.025 + t * 0.3 )
	+ 0.55 * Math.sin( - x * 0.07 + z * 0.15 - t * 0.55 )
	+ 0.08 * Math.sin( x * 0.21 - z * 0.16 + t * 0.7 )
	+ 0.03 * Math.sin( x * 0.42 + z * 0.09 + t * 1.3 )
	+ 0.01 * Math.sin( x * 0.72 - z * 0.48 + t * 1.6 );
assert.ok( Math.abs( query._height( x, z ) - expectedBase ) > 0.05, 'WebGL gameplay query includes depth-aware shore displacement in addition to the offshore base waves' );
assert.ok( Math.abs( query._height( 64.5, 36.5 ) - ( - 1.1862450522107852 ) ) < 1e-6, 'the dock query matches the rendered shore-wave height at a fixed simulation time' );
query.time = 0;
const boat = new BoatController( { design: new BoatDesign(), query, terrain: world.terrain, colliders: world.colliders } );

let maximumTilt = 0;
let maximumSpeed = 0;
for ( let i = 0; i < 60 * 90; i ++ ) {
	boat.queueQueries();
	query.update( 1 / 60 );
	boat.update( 1 / 60 );
	const up = new Vector3( 0, 1, 0 ).applyQuaternion( boat.quaternion );
	maximumTilt = Math.max( maximumTilt, Math.acos( Math.min( 1, Math.max( - 1, up.y ) ) ) );
	maximumSpeed = Math.max( maximumSpeed, boat.speed );
}

assert.equal( boat.moored, true, 'an unused boat remains moored' );
assert.ok( maximumTilt < Math.PI / 4, `idle WebGL boat remains upright (max tilt ${ ( maximumTilt * 180 / Math.PI ).toFixed( 1 ) } degrees)` );
assert.ok( maximumSpeed < 2, `idle WebGL boat stays near its berth (max speed ${ maximumSpeed.toFixed( 2 ) } m/s)` );
assert.ok( [ ...boat.position.toArray(), ...boat.quaternion.toArray() ].every( Number.isFinite ) );

console.log( `idle WebGL boat stable for 90 seconds (max tilt ${( maximumTilt * 180 / Math.PI ).toFixed( 1 )} degrees, max drift ${ maximumSpeed.toFixed( 2 )} m/s)` );
