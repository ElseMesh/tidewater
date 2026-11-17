import assert from 'node:assert/strict';
import { tidewaterLocalLightSet } from '../WorldLights.js';
import { validateWorldLocalLightSet } from '../../../src/network/WorldLocalLightSet.js';

const village = {
	buildings: [ { x: 0, z: 0 } ],
	getLightSources: () => [
		{ position: { x: 2, y: 3, z: 0, toArray: () => [ 2, 3, 0 ] }, color: { toArray: () => [ 1, 0.72, 0.42 ] }, intensity: 5, kind: 'lantern' },
		{ position: { x: 4, y: 2, z: 0, toArray: () => [ 4, 2, 0 ] }, color: { toArray: () => [ 1, 0.62, 0.32 ] }, intensity: 2, kind: 'window' },
	],
};
const lights = tidewaterLocalLightSet( village );
const component = { type: 'elsemesh.local-light-set/1', data: { lights } };
assert.equal( lights[ 0 ].intensity, 7.5, 'Tidewater authored lantern profile keeps its established intensity' );
assert.equal( lights[ 0 ].range, 11, 'Tidewater authored lantern profile keeps its established range' );
assert.equal( lights[ 0 ].flicker, 0.08, 'the world profile carries the lantern flicker amount' );
assert.deepEqual( lights[ 1 ].direction, [ 1, 0, 0 ], 'window light points away from the nearest building' );
assert.equal( lights[ 1 ].position[ 0 ], 4.35, 'window light sits just outside the authored pane' );
assert.equal( validateWorldLocalLightSet( component ), lights, 'the Tidewater world profile satisfies the shared engine contract' );

console.log( `Tidewater world local-light profile passed (${lights.length} sources)` );
