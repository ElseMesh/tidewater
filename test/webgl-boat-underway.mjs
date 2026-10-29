import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3 } from '../../../src/engine/math/Vector3.js';
import { WebGLWaterQuery } from '../../../src/fallback/WebGLWaterQuery.js';
import { BoatController } from '../../../src/player/BoatController.js';
import { BoatDesign } from '../../../src/world/boat/BoatDesign.js';
import { ISLAND_DEFINITION } from '../../../src/world/IslandDefinition.js';
import { IslandWorldState } from '../../../src/world/IslandWorldState.js';
import { computeShoreField } from '../../../src/world/ShoreField.js';
import '../register-behavior.js';
import { dispatchWorldBehaviorHooks } from '../../../src/network/WorldBehaviorRegistry.js';

const world = new IslandWorldState();
const source = JSON.parse( readFileSync( new URL( '../world-source.json', import.meta.url ), 'utf8' ) );
const seaLevel = source.rules.seaLevel;
const shoreField = computeShoreField( world.terrain, { res: 512, swellDir: [ - 0.12, - 1 ], seaLevel } );
const query = new WebGLWaterQuery( world.terrain, seaLevel );
dispatchWorldBehaviorHooks( { behaviors: { 'elsemesh.shore-aware-boat/1': {} } }, 'onWebGLWorldActivated', {
	fallback: { waterQuery: query, terrain: world.terrain, shoreField, worldSeaLevel: seaLevel }, mode: 'builtin',
} );

const boat = new BoatController( { design: new BoatDesign(), query, terrain: world.terrain, colliders: world.colliders, initialPosition: new Vector3( ...ISLAND_DEFINITION.boatDock.position ), initialHeading: ISLAND_DEFINITION.boatDock.heading } );
const start = boat.position.clone();
boat.driven = true;
boat.moored = false;

let straightSpeed = 0;
let maximumTilt = 0;
for ( let frame = 0; frame < 18 * 60; frame ++ ) {
	const dt = 1 / 60;
	boat.setInput( 1, frame < 12 * 60 ? 0 : - 0.7, dt );
	boat.queueQueries();
	query.update( dt, ( frame + 1 ) * dt );
	boat.update( dt );
	if ( frame === 12 * 60 - 1 ) straightSpeed = boat.speed;
	const up = new Vector3( 0, 1, 0 ).applyQuaternion( boat.quaternion );
	maximumTilt = Math.max( maximumTilt, Math.acos( Math.min( 1, Math.max( - 1, up.y ) ) ) );
}

assert.ok( boat.isFinite(), 'the underway boat state remains finite' );
assert.ok( straightSpeed > 8 && straightSpeed < 16, `boat reaches a plausible full-ahead speed (${ straightSpeed.toFixed( 2 ) } m/s)` );
assert.ok( boat.position.distanceTo( start ) > 100, `boat travels during the underway and turn sequence (${ boat.position.distanceTo( start ).toFixed( 1 ) } m)` );
assert.ok( maximumTilt < Math.PI / 6, `boat stays upright while underway (maximum tilt ${ ( maximumTilt * 180 / Math.PI ).toFixed( 1 ) } degrees)` );
assert.ok( Math.abs( boat.position.y ) < 1, `boat remains at the water surface (y ${ boat.position.y.toFixed( 2 ) } m)` );

console.log( `WebGL underway boat stable for 18 seconds (straight speed ${ straightSpeed.toFixed( 2 ) } m/s, travel ${ boat.position.distanceTo( start ).toFixed( 1 ) } m, maximum tilt ${ ( maximumTilt * 180 / Math.PI ).toFixed( 1 ) } degrees)` );
