import assert from 'node:assert/strict';
import { registerWorldComponentAssetDecoder } from '../../../src/network/WorldComponentAssetCodecRegistry.js';
import { worldComponentBackendBatchAdapter } from '../../../src/network/WorldComponentBackendRegistry.js';
import { encodeGrassDensityAsset } from '../../../src/network/GrassDensityAsset.js';
import '../renderers/WebGLVegetationComponentAdapter.js';

const type = 'elsemesh.static-vegetation/1';
const placementKind = 'test-plants/1';
const components = [
	{ id: 'canopy-a', type, placementAssetId: 'plants-a', grassMaskAssetId: 'mask-a', assets: [ { assetId: 'plants-a', kind: placementKind }, { assetId: 'mask-a', kind: 'grass-density/1' } ] },
	{ id: 'canopy-b', type, placementAssetId: 'plants-b', assets: [ { assetId: 'plants-b', kind: placementKind } ] },
];
const decoded = [], removed = [];
const records = Object.fromEntries( [ 'palms', 'trees', 'shrubs', 'youngPalms', 'ferns', 'bananas', 'monsteras', 'elephantEars', 'heliconias', 'strelitzias' ].map( kind => [ kind, [] ] ) );
registerWorldComponentAssetDecoder( placementKind, bytes => ( decoded.push( Array.from( bytes ) ), records ) );
class Group {
	constructor() { this.children = []; }
	add( child ) { this.children.push( child ); child.parent = this; }
	remove( child ) { this.children = this.children.filter( item => item !== child ); child.parent = null; }
	traverse( visit ) { visit( this ); for ( const child of this.children ) child.traverse?.( visit ); }
}
const fallback = {
	THREE: { Group, DoubleSide: 2, MeshStandardMaterial: class { dispose() {} } },
	scene: new Group(),
	terrain: { origin: 0, size: 1, texel: 1, res: 2, heights: new Float32Array( 4 ) },
};
const sceneRemove = fallback.scene.remove.bind( fallback.scene );
fallback.scene.remove = group => { removed.push( group ); sceneRemove( group ); };
const mask = encodeGrassDensityAsset( { data: new Uint8Array( [ 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ] ), res: 2, size: 1, origin: 0 } );
const assets = new Map( [ [ 'plants-a', new Uint8Array( [ 1 ] ) ], [ 'plants-b', new Uint8Array( [ 2 ] ) ], [ 'mask-a', mask ] ] );
const adapter = worldComponentBackendBatchAdapter( 'webgl', type );
const result = await adapter( { fallback, assets, manifest: { spawn: { position: [ 12, 2, - 8 ] } } }, components );

assert.deepEqual( result.componentIDs, [ 'canopy-a', 'canopy-b' ] );
assert.deepEqual( decoded, [ [ 1 ], [ 2 ] ], 'Tidewater WebGL vegetation dispatches the owner-registered placement codec' );
assert.equal( fallback.vegetationRecords.trees.length, 0 );
assert.ok( fallback.grassCellPlanner, 'built-in package density data installs the shared engine cell planner' );
assert.ok( fallback.grassCellPlanner.update( { x: 0, z: 0 } )[ 0 ].count > 0, 'the shared planner selects cells from the signed density mask' );
assert.equal( fallback.scene.children.length, 2, 'the Tidewater adapter installs its own renderer groups' );
result.runtime.dispose();
assert.equal( removed.length, 2, 'world teardown removes each static vegetation group' );
console.log( 'Tidewater WebGL static vegetation uses its world-owned codec and renderer adapter' );
