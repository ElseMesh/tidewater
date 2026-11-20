import assert from 'node:assert/strict';
import { tidewaterBoatLocalLights, tidewaterLocalLightSet } from '../WorldLights.js';
import { validateWorldLocalLightSet } from '../../../src/network/WorldLocalLightSet.js';

const village = {
	buildings: [ { x: 0, z: 0 } ],
	getLightSources: () => [
		{ position: { x: 2, y: 3, z: 0, toArray: () => [ 2, 3, 0 ] }, color: { toArray: () => [ 1, 0.72, 0.42 ] }, intensity: 5, kind: 'lantern' },
		{ position: { x: 4, y: 2, z: 0, toArray: () => [ 4, 2, 0 ] }, color: { toArray: () => [ 1, 0.62, 0.32 ] }, intensity: 2, kind: 'window' },
	],
};
const lights = [ ...tidewaterLocalLightSet( village ), ...tidewaterBoatLocalLights( { lines: { sheerY: () => 2.4, zAft: - 3.6 } } ) ];
const component = { type: 'elsemesh.local-light-set/1', data: { lights } };
assert.equal( lights[ 0 ].intensity, 7.5, 'Tidewater authored lantern profile keeps its established intensity' );
assert.equal( lights[ 0 ].range, 11, 'Tidewater authored lantern profile keeps its established range' );
assert.equal( lights[ 0 ].flicker, 0.08, 'the world profile carries the lantern flicker amount' );
assert.deepEqual( lights[ 1 ].direction, [ 1, 0, 0 ], 'window light points away from the nearest building' );
assert.equal( lights[ 1 ].position[ 0 ], 4.35, 'window light sits just outside the authored pane' );
assert.equal( lights.length, 8, 'the world exports six boat-mounted lights alongside its village lights' );
assert.equal( lights[ 2 ].objectId, 'elsemesh-object:moored-lobster-boat', 'vehicle lights attach to the signed boat object' );
assert.equal( lights[ 7 ].position[ 1 ], 2.5, 'the stern light follows the authored sheer height' );
assert.equal( lights[ 7 ].position[ 2 ], - 3.65, 'the stern light follows the authored aft station' );
assert.equal( lights[ 4 ].type, 'spot', 'port navigation lighting is encoded as renderer-neutral spot data' );
assert.equal( validateWorldLocalLightSet( component ), lights, 'the Tidewater world profile satisfies the shared engine contract' );

console.log( `Tidewater world local-light profile passed (${lights.length} sources)` );
