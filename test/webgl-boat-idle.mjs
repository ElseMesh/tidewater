import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3 } from '../../../src/engine/math/Vector3.js';
import { SyntheticWaterQuery } from './synthetic-water-query.mjs';
import { BoatController } from '../../../src/player/BoatController.js';
import { BoatDesign } from '../../../src/world/boat/BoatDesign.js';
import { ISLAND_DEFINITION } from '../../../src/world/IslandDefinition.js';
import { IslandWorldState } from '../../../src/world/IslandWorldState.js';
import { computeShoreField } from '../../../src/world/ShoreField.js';
import '../register-behavior.js';
import { dispatchWorldBehaviorHooks } from '../../../src/network/WorldBehaviorRegistry.js';

const world = new IslandWorldState();
const worldSource = JSON.parse( readFileSync( new URL( '../world-source.json', import.meta.url ), 'utf8' ) );
const seaLevel = worldSource.rules.seaLevel;
const shoreField = computeShoreField( world.terrain, { res: 512, swellDir: [ - 0.12, - 1 ], seaLevel } );
const query = new SyntheticWaterQuery( world.terrain, seaLevel );
const experience = { behaviors: { 'elsemesh.shore-aware-boat/1': {} } };
dispatchWorldBehaviorHooks( experience, 'onWebGLWorldActivated', {
	fallback: { waterQuery: query, terrain: world.terrain, shoreField, worldSeaLevel: seaLevel }, mode: 'builtin',
} );
query.update( 0, 3.25 );
const baseQuery = new SyntheticWaterQuery( world.terrain, seaLevel );
baseQuery.update( 0, 3.25 );
assert.ok( Math.abs( query._height( 64.5, 36.5 ) - baseQuery._height( 64.5, 36.5 ) ) > 0.2, 'WebGL gameplay query includes depth-aware shore displacement at the default berth' );
assert.ok( Math.abs( query._height( 64.5, 36.5 ) - ( - 0.9965546952995952 ) ) < 1e-6, 'the dock query matches the f32-matched, crest-depth shore-wave height at a fixed simulation time' );
const hostedQuery = new SyntheticWaterQuery( world.terrain, seaLevel );
dispatchWorldBehaviorHooks( experience, 'onWebGLWorldActivated', {
	fallback: { waterQuery: hostedQuery, hostedTerrainData: world.terrain, hostedTerrainSurface: { shoreField }, worldSeaLevel: seaLevel }, mode: 'hosted',
} );
hostedQuery.update( 0, 3.25 );
assert.ok( Math.abs( hostedQuery._height( 64.5, 36.5 ) - query._height( 64.5, 36.5 ) ) < 1e-6, 'hosted WebGL boat queries use the signed hosted shore field' );
query.time = 0;
const boat = new BoatController( { design: new BoatDesign(), query, terrain: world.terrain, colliders: world.colliders, initialPosition: new Vector3( ...ISLAND_DEFINITION.boatDock.position ), initialHeading: ISLAND_DEFINITION.boatDock.heading } );

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
