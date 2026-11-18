// Render Tidewater's signed scanned-debris package through ElseMesh's WebGPU adapter.
//   node --preserve-symlinks worlds/tidewater/test/webgpu-scanned-debris-package-render.mjs [output.png]
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import '../../../test/headless.mjs';
import { setupLife } from '../../../test/life-harness.mjs';
import { readTexture } from '../../../src/engine/gpu/Readback.js';
import { Group } from '../../../src/engine/scene/Group.js';
import { ShaderModule } from '../../../src/engine/gpu/Shader.js';
import { worldComponentBackendAdapter } from '../../../src/network/WorldComponentBackendRegistry.js';
import { disposeWorldPackage } from '../../../src/network/WorldPackage.js';
import { GPU } from '../../../src/engine/gpu/GPU.js';
import { G } from '../../../src/engine/render/Frame.js';
import { SceneLighting } from '../../../src/engine/render/wgsl/lighting.js';
import '../../../src/network/WebGPUWorldComponentAdapters.js';

const testRoot = dirname( fileURLToPath( import.meta.url ) );
const assetsRoot = resolve( testRoot, '../assets' );
const output = process.argv[ 2 ] || '/var/tmp/elsemesh-tidewater-scanned-debris-webgpu.png';
const lightingMode = process.env.ELSEMESH_DEBRIS_LIGHTING || 'full';
assert( [ 'full', 'direct', 'diffuse', 'ambient' ].includes( lightingMode ), `unknown scanned-debris lighting diagnostic mode ${lightingMode}` );
const source = JSON.parse( readFileSync( resolve( testRoot, '../world-source.json' ), 'utf8' ) );
const component = source.components.find( entry => entry.id === 'elsemesh-component:scanned-debris' );
assert( component, 'Tidewater source contains the signed scanned-debris component' );

const assetPath = assetId => {
	assert.match( assetId, /^sha256:[0-9a-f]{64}$/, `signed package uses a content hash: ${assetId}` );
	return join( assetsRoot, assetId.slice( 'sha256:'.length ) );
};
const hashBytes = bytes => `sha256:${createHash( 'sha256' ).update( bytes ).digest( 'hex' )}`;
const descriptorReference = component.assets.find( reference => reference.kind === 'static-model-instance-set/1' );
assert( descriptorReference, 'component references its signed placement document' );
const descriptorBytes = readFileSync( assetPath( descriptorReference.assetId ) );
assert.equal( hashBytes( descriptorBytes ), descriptorReference.assetId, 'placement document matches its signed asset ID' );
const requestedAssets = new Map( [ [ descriptorReference.assetId, descriptorBytes ] ] );
const connector = {
	worldId: source.worldId,
	manifest: {
		assets: component.assets.map( reference => ( { id: reference.assetId, kind: reference.kind } ) ),
		components: [ component ],
		objects: [], portals: [],
	},
	assets: requestedAssets,
	staticModelPlacementOwners: new Map(),
	async getAsset( assetId ) {
		if ( ! requestedAssets.has( assetId ) ) {
			const bytes = readFileSync( assetPath( assetId ) );
			assert.equal( hashBytes( bytes ), assetId, `loaded package asset matches signed ID ${assetId}` );
			requestedAssets.set( assetId, bytes );
		}
		return requestedAssets.get( assetId );
	},
};

const previousAssetImage = globalThis.__assetImage;
globalThis.__assetImage = async ( bytes, mimeType ) => {
	assert.equal( mimeType, 'image/jpeg', 'scanned-debris materials use the authored JPEG assets' );
	const imageBytes = Buffer.from( bytes );
	const dimensions = execFileSync( 'identify', [ '-format', '%w %h', 'jpeg:-' ], { input: imageBytes, encoding: 'utf8' } ).split( /\s+/ ).map( Number );
	const [ width, height ] = dimensions;
	assert( Number.isInteger( width ) && Number.isInteger( height ) && width > 0 && height > 0, 'signed JPEG has valid dimensions' );
	const pixels = execFileSync( 'convert', [ 'jpeg:-', '-depth', '8', 'rgba:-' ], { input: imageBytes, maxBuffer: 16 * 1024 * 1024 } );
	assert.equal( pixels.length, width * height * 4, 'JPEG decoder returns every authored RGBA texel' );
	return { data: new Uint8Array( pixels ), width, height };
};

let life;
const errors = [];
let runtime;
const root = new Group();
const terrainHeightModule = new ShaderModule( {
	name: 'scannedDebrisFixtureTerrainHeight',
	code: 'fn terrainHeightAt( xz: vec2f ) -> f32 { return 0.0; }',
} );
root.userData.worldComponents = [ { terrainSurface: true, terrainGPU: { heightModule: terrainHeightModule } } ];
root.userData.worldPackage = {
	parsed: new Map(), loadedObjects: new Set(), connector,
	materialAdapterContexts: new Map(),
};

try {
	life = await setupLife( { W: 192, H: 144, fov: 55, near: 0.1, far: 1000, shadowSplits: [ 12 ] } );
	// This fixture measures package geometry and material coverage. Compare color
	// shadows in a separate paired fixture rather than letting WebGPU's shadow map
	// affect an RGB-derived silhouette while WebGL has no shadow pass enabled.
	life.shadowsOn = false;
	if ( lightingMode === 'direct' ) {
		G.skyIrradiance.value.setRGB( 0, 0, 0 );
		G.horizonColor.value.setRGB( 0, 0, 0 );
	} else if ( lightingMode === 'ambient' || lightingMode === 'diffuse' ) {
		if ( lightingMode === 'ambient' ) G.sunColor.value.setRGB( 0, 0, 0 );
		// This fixture has no WebGL scene.environment PMREM. Disable the WebGPU
		// specular hook too so diffuse/ambient modes compare matched diffuse terms.
		SceneLighting.set( 'envSpecular', new ShaderModule( {
			name: 'test-neutral-env-specular',
			code: 'fn hookEnvSpecular( R: vec3f, roughness: f32 ) -> vec3f { return vec3f( 0.0 ); }',
		} ) );
	}
	GPU.device.addEventListener( 'uncapturederror', event => errors.push( event.error?.message || 'unknown WebGPU error' ) );
	const install = worldComponentBackendAdapter( 'webgpu', component.type );
	assert.equal( typeof install, 'function', 'ElseMesh registers the generic WebGPU static-model adapter' );
	const result = await install( { root, connector }, component );
	runtime = result.runtime;
	assert.equal( runtime.document.instances.length, 141, 'WebGPU reads the same 141 authored placements as WebGL' );
	const beachTrunk = runtime.document.instances
		.filter( instance => instance.model === 'dead_quiver_trunk' && Math.hypot( instance.position[ 0 ] - 18, instance.position[ 2 ] + 52 ) < 40 )
		.sort( ( a, b ) => Math.max( ...b.scale ) - Math.max( ...a.scale ) )[ 0 ];
	assert( beachTrunk, 'the signed package contains the WebGL fixture beach trunk' );
	const trunkIndex = runtime.document.instances.indexOf( beachTrunk );
	const modelIndex = runtime.document.models.findIndex( model => model.id === beachTrunk.model );
	const batchOffset = runtime.document.models.slice( 0, modelIndex ).reduce( ( count, model ) => count + model.lods.length, 0 );
	const [ x, y, z ] = beachTrunk.position;
	life.camera.position.set( x + 6, y + 1.7, z + 4.5 );
	life.camera.lookAt( x, y, z );
	life.camera.updateProjectionMatrix();
	life.scene.add( root );

	const deadline = Date.now() + 30000;
	while ( Date.now() < deadline ) {
		await life.run( 1, dt => runtime.update( dt, life.camera ) );
		const desiredLOD = runtime.desiredLods[ modelIndex ];
		const desiredLoaded = desiredLOD >= 0 && runtime.loadedLods[ modelIndex ].has( desiredLOD );
		const targetColorLOD = desiredLoaded && runtime.batches[ batchOffset + desiredLOD ]?.some( batch => batch.mesh.count > 0 && batch.mesh.material.colorWrite && ! batch.mesh.userData.shadowOnly );
		if ( targetColorLOD && requestedAssets.size > 1 ) break;
		await new Promise( resolve => setTimeout( resolve, 10 ) );
	}
	const lodGroups = runtime.planner._groupsByModel[ modelIndex ];
	const selectedLOD = lodGroups.findIndex( group => group.indices.subarray( 0, group.count ).includes( trunkIndex ) );
	assert( selectedLOD >= 0, 'shared WebGPU LOD planner selects the same target trunk' );
	assert.equal( selectedLOD, runtime.desiredLods[ modelIndex ], 'WebGPU renders the camera-selected LOD after its residency request completes' );
	assert.equal( selectedLOD, 0, 'the close beach-trunk view selects LOD0, the highest-detail model' );
	const selectedAsset = runtime.document.models[ modelIndex ].lods[ selectedLOD ].assetId;
	assert( requestedAssets.has( selectedAsset ), `the selected WebGPU LOD loads its signed GLB ${selectedAsset}` );
	assert( runtime.batches[ batchOffset + selectedLOD ]?.some( batch => batch.mesh.count > 0 && batch.mesh.material.colorWrite && ! batch.mesh.userData.shadowOnly ), 'the selected beach trunk enters a WebGPU color LOD' );
	const textureIDs = component.assets.filter( asset => asset.kind === 'image/jpeg' ).map( asset => asset.assetId );
	const loadedTextures = textureIDs.filter( assetId => requestedAssets.has( assetId ) );
	assert( loadedTextures.length > 0, 'WebGPU loads signed scanned-debris JPEG assets from the world package' );
	await life.run( 3, dt => runtime.update( dt, life.camera ) );
	const rendered = await readTexture( life.ldr.texture );
	const pixels = new Uint8Array( rendered.data );
	const background = pixels.slice( 0, 3 );
	let changedPixels = 0;
	for ( let offset = 0; offset < pixels.length; offset += 4 ) {
		if ( Math.abs( pixels[ offset ] - background[ 0 ] ) + Math.abs( pixels[ offset + 1 ] - background[ 1 ] ) + Math.abs( pixels[ offset + 2 ] - background[ 2 ] ) > 24 ) changedPixels ++;
	}
	assert( changedPixels >= 30, `the signed Tidewater beach trunk renders visible WebGPU pixels (${changedPixels})` );
	assert.deepEqual( errors, [], `Tidewater signed debris shaders have no WebGPU errors: ${errors.join( '; ' )}` );
	await life.save( output );
	console.log( `Tidewater signed debris WebGPU render passed: ${changedPixels} pixels, ${runtime.document.instances.length} placements, ${loadedTextures.length} signed textures, LOD ${selectedLOD} (${selectedAsset}), lighting ${lightingMode}; PNG ${output}` );
} finally {
	runtime?.dispose();
	disposeWorldPackage( root );
	GPU.device?.destroy();
	if ( previousAssetImage === undefined ) delete globalThis.__assetImage;
	else globalThis.__assetImage = previousAssetImage;
}

