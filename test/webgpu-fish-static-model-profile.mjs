import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setupLife } from '../../../test/life-harness.mjs';
import { readTexture } from '../../../src/engine/gpu/Readback.js';
import { Group } from '../../../src/engine/scene/Group.js';
import { worldComponentBackendAdapter } from '../../../src/network/WorldComponentBackendRegistry.js';
import { registeredWorldPackageMaterialAdapters } from '../../../src/network/WorldPackageMaterialAdapterRegistry.js';
import { STATIC_MODEL_INSTANCE_SET_ASSET_KIND, STATIC_MODEL_INSTANCE_SET_FORMAT } from '../../../src/network/StaticModelInstanceSet.js';
import { GPU } from '../../../src/engine/gpu/GPU.js';
import { FISH_PROP_MATERIAL_COMPONENT, FISH_PROP_MATERIAL_DESCRIPTOR, FISH_PROP_MATERIAL_PROFILE } from '../FishPropMaterialProfile.js';
import '../register-components.js';
import { staticFishGLB } from './helpers/static-fish-glb.mjs';
import '../../../src/network/WebGPUWorldComponentAdapters.js';

const hash = bytes => `sha256:${createHash( 'sha256' ).update( bytes ).digest( 'hex' )}`;
const role = 'prop';
const glb = staticFishGLB( { materialExtras: { elsemeshMaterial: { profile: FISH_PROP_MATERIAL_PROFILE, role } } } );
const glbAssetID = hash( glb );
const instanceSet = {
	format: STATIC_MODEL_INSTANCE_SET_FORMAT,
	models: [ { id: 'fish', bounds: { center: [ 0, 0.5, 0 ], radius: 0.75 }, geometryMirrorX: false, lods: [ { assetId: glbAssetID } ], lodThresholds: [], lodMetric: 'scaled-distance', lodFadeFraction: 0.12, shadowLod: 0, shadowMaxDistance: 22, drawMaxDistance: 90, drawFadeStartDistance: 81 } ],
	instances: [ { model: 'fish', position: [ 0, 0, - 5 ], rotation: [ 0, 0, 0, 1 ], scale: [ 1, 1, 1 ], materialData: [ 0.9, - 0.08, 0.12, 0.2, 0.2, 0.75, 0, 0 ] } ],
};
const setBytes = new TextEncoder().encode( JSON.stringify( instanceSet ) ), setAssetID = hash( setBytes );
const component = { id: 'fish-set', type: 'elsemesh.static-model-instance-set/1', assets: [ { assetId: setAssetID, kind: STATIC_MODEL_INSTANCE_SET_ASSET_KIND }, { assetId: glbAssetID, kind: 'glb' } ] };
const materialComponent = { id: 'fish-materials', type: FISH_PROP_MATERIAL_COMPONENT, data: { profile: FISH_PROP_MATERIAL_DESCRIPTOR } };
const connector = {
	manifest: {
		rules: { requiredFeatures: [ FISH_PROP_MATERIAL_COMPONENT ] },
		assets: [ { id: setAssetID, kind: STATIC_MODEL_INSTANCE_SET_ASSET_KIND }, { id: glbAssetID, kind: 'glb' } ],
		components: [ materialComponent ],
	},
	assets: new Map( [ [ setAssetID, setBytes ] ] ),
	getAsset: async id => id === glbAssetID ? glb : null,
};
const materialAdapter = registeredWorldPackageMaterialAdapters().find( adapter => adapter.componentType === FISH_PROP_MATERIAL_COMPONENT );
assert( materialAdapter, 'Tidewater registers its signed fish material profile adapter' );
const prepared = await materialAdapter.prepare( { connector, component: materialComponent } );
const contexts = new Map( [ [ FISH_PROP_MATERIAL_COMPONENT, { component: materialComponent, context: prepared.context, dispose: prepared.dispose } ] ] );
const errors = [];
const life = await setupLife( { W: 192, H: 144, shadowSplits: [ 12 ] } );
let runtime;
try {
	GPU.device.addEventListener( 'uncapturederror', event => errors.push( event.error?.message || 'unknown GPU error' ) );
	const root = new Group();
	root.userData.worldPackage = { parsed: new Map(), loadedObjects: new Set(), connector, materialAdapterContexts: contexts };
	const install = worldComponentBackendAdapter( 'webgpu', component.type );
	const installed = await install( { root, connector }, component );
	runtime = installed.runtime;
	assert.equal( installed.installed, true );
	const mesh = runtime.batches[ 0 ][ 0 ].mesh;
	assert( mesh.material.attributes.aData, 'Tidewater fish profile binds the GLB vertex semantics' );
	assert( mesh.geometry.getAttribute( 'aData' ), 'Tidewater maps signed VEC4 _ELSEMESH_VDATA into the fish shader input' );
	assert( mesh.material.attributes.iStaticMaterialData0 && mesh.material.attributes.iStaticMaterialData1, 'both opaque instance vectors reach the world material' );
	life.scene.add( root );
	life.camera.position.set( 0, 0.5, 4 );
	life.camera.lookAt( 0, 0.5, - 5 );
	await life.run( 3, dt => runtime.update( dt, life.camera ) );
	const pixels = new Uint8Array( ( await readTexture( life.ldr.texture ) ).data );
	const background = pixels.slice( 0, 3 );
	let changedPixels = 0;
	for ( let offset = 0; offset < pixels.length; offset += 4 ) if ( Math.abs( pixels[ offset ] - background[ 0 ] ) + Math.abs( pixels[ offset + 1 ] - background[ 1 ] ) + Math.abs( pixels[ offset + 2 ] - background[ 2 ] ) > 24 ) changedPixels ++;
	assert( changedPixels >= 10, `Tidewater static fish profile renders pixels (${changedPixels})` );
	assert.deepEqual( errors, [], `Tidewater static fish color and shadow pipelines compile: ${errors.join( '; ' )}` );
	console.log( `Tidewater WebGPU static fish material profile passed (${changedPixels} non-background pixels; color and shadow pipelines compiled)` );
} finally {
	runtime?.dispose();
	prepared.dispose?.();
	GPU.device.destroy();
}
