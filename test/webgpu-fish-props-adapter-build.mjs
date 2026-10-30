// Headless WebGPU adapter construction check. It creates the actual GPU buffers
// for the registered world component, but does not render pixels or measure FPS.
import '../../../test/headless.mjs';
import assert from 'node:assert/strict';
import { GPU } from '../../../src/engine/gpu/GPU.js';
import { Group } from '../../../src/engine/scene/Group.js';
import { worldComponentBackendAdapter } from '../../../src/network/WorldComponentBackendRegistry.js';
import { encodeFishPropPlacements } from '../FishPropPlacements.js';
import * as fishPresentation from '../FishPresentation.js';
import '../register-behavior.js';

const records = [
	{ kind: 'whole', species: 'mullet', L: 0.4, x: 1.25, y: 3, z: -2.5, q: [ 0, 0.7071067811865475, 0, 0.7071067811865476 ], pattern: 14, seed: 0.972, curl: -0.1, sag: 0.15, jaw: 0.2, flags: [ 0.6, 0.6, 0, 0 ] },
	{ kind: 'ice', species: null, L: 0.25, x: 0, y: 0.1, z: 0, q: [ 0, 0, 0, 1 ], pattern: 0, seed: 0.5, curl: 0, sag: 0, jaw: 0, flags: [ 0, 0, 0, 0 ] },
];
const bytes = encodeFishPropPlacements( records, fishPresentation );
const componentType = 'elsemesh.static-fish-props/1';
const adapter = worldComponentBackendAdapter( 'webgpu', componentType );
assert.equal( typeof adapter, 'function', 'Tidewater registers its WebGPU fish-prop adapter' );

await GPU.init( { headless: true } );
const root = new Group();
let runtime;
try {
	GPU.device.pushErrorScope( 'validation' );
	const installed = adapter( {
		root,
		connector: {
			manifest: { experience: { behaviors: { 'elsemesh.fishing-game/1': {} } } },
			assets: new Map( [ [ 'placements', bytes ] ] ),
		},
	}, { id: 'fish-props', type: componentType, placementAssetId: 'placements' } );
	runtime = installed.runtime;
	assert.equal( installed.installed, true, 'the registered adapter installs the signed placement component' );
	assert.equal( root.children.length, 1 );
	assert.equal( root.children[ 0 ].name, 'village_fish' );
	assert( root.children[ 0 ].geometry.attributes.position.count > 0 );
	const indirectBuffer = root.children[ 0 ].geometry.indirect.buffer;
	assert( indirectBuffer, 'the WebGPU mesh uses its instanced indirect draw buffer' );
	assert( indirectBuffer.getGPU(), 'the adapter creates a real WebGPU indirect buffer' );
	assert.equal( root.children[ 0 ].children.length, 1, 'the mesh includes its LOD fade child' );
	assert.equal( await GPU.device.popErrorScope(), null, 'adapter construction creates valid WebGPU buffers' );
	runtime.dispose();
	runtime = null;
	assert.equal( root.children.length, 0, 'disposing removes the component mesh and GPU resources' );
	console.log( 'Headless WebGPU fish-prop adapter construction passed (no rendered pixels)' );
} finally {
	runtime?.dispose();
	GPU.device.destroy();
}
