import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import '../../../test/headless.mjs';
import '../../../test/smaa-shim.mjs';
import { setupLife } from '../../../test/life-harness.mjs';
import '../register-behavior.js';
import { GPU } from '../../../src/engine/gpu/GPU.js';
import { readTexture } from '../../../src/engine/gpu/Readback.js';
import { loadWorldPackage, disposeWorldPackage } from '../../../src/network/WorldPackage.js';
import { decodeVillageMaterialAsset } from '../VillageMaterialAsset.js';
import { VILLAGE_MATERIAL_PROFILE, VILLAGE_MATERIAL_ROLES } from '../VillageMaterialProfile.js';
import { TIDEWATER_NET_MATERIAL_GRAPH } from '../VillageMaterialGraphs.js';
import { createWebGLMaterialGraph } from '../../../src/materials/WorldMaterialGraph.js';
import { compileWorldMaterialGraph } from '../../../src/materials/WorldMaterialGraphCompiler.js';

const netGraphWebGPU = compileWorldMaterialGraph( TIDEWATER_NET_MATERIAL_GRAPH, 'webgpu', { doubleSided: true } );
const netGraphWebGL = compileWorldMaterialGraph( TIDEWATER_NET_MATERIAL_GRAPH, 'webgl', { doubleSided: true } );
assert.deepEqual( netGraphWebGPU.textureSlots, [ 'metallicRoughness' ] );
assert.match( netGraphWebGPU.vertex, /frame\.time/ );
assert.match( netGraphWebGPU.vertex, /frame\.windDir/ );
assert.match( netGraphWebGPU.surface, /normalFromSlope|perturbNormalByMap/ );
assert.match( netGraphWebGPU.surface, /mix\( emg_netAlpha, emg_farCoverage, emg_far \)/, 'net strands retain the source shader far-coverage blend' );
assert.match( netGraphWebGPU.surface, /in\.vs\.emg_colorRGB \* emg_albedo/, 'net graph applies the authored COLOR_0 tint' );
assert.match( netGraphWebGPU.surface, /mix\( emg_shadeNear, emg_shadeFar, emg_far \)/, 'net graph retains the source shader distance shading' );
assert.match( netGraphWebGL.glsl.fragment, /gl_FrontFacing/ );
assert.match( netGraphWebGL.glsl.vertex, /emgWindDirection/ );
assert.match( netGraphWebGL.glsl.fragment, /vEmg_colorRGB \* emg_albedo/, 'WebGL graph applies the same authored COLOR_0 tint' );
const netGraphTexture = new THREE.DataTexture( new Uint8Array( [ 128, 128, 128, 255 ] ), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType );
const netSourceMaterial = new THREE.MeshStandardMaterial( { side: THREE.DoubleSide, transparent: true, depthWrite: false, metalnessMap: netGraphTexture } );
const webglNet = createWebGLMaterialGraph( THREE, netSourceMaterial, TIDEWATER_NET_MATERIAL_GRAPH );
const netGraphShader = { vertexShader: '#include <common>\n#include <begin_vertex>\n#include <defaultnormal_vertex>\n#include <worldpos_vertex>', fragmentShader: '#include <common>\n#include <lights_physical_fragment>', uniforms: {} };
webglNet.material.onBeforeCompile( netGraphShader );
assert.match( netGraphShader.vertexShader, /emgWindDirection/ );
assert.match( netGraphShader.fragmentShader, /texture2D\( emgTexture_metallicRoughness/ );
assert.match( netGraphShader.fragmentShader, /gl_FrontFacing \? 1\.0 : -1\.0/ );
assert.match( netGraphShader.fragmentShader, /vEmg_colorRGB \* emg_albedo/ );
webglNet.material.dispose();
netSourceMaterial.dispose();
netGraphTexture.dispose();

const source = JSON.parse( await readFile( new URL( '../world-source.json', import.meta.url ) ) );
const village = source.objects.find( object => object.id === 'elsemesh-object:island-village' );
const previewObject = source.objects.find( object => object.priority === 'portal-preview' && object.id !== village.id );
const bytes = new Uint8Array( await readFile( new URL( `../assets/${village.assetId.slice( 'sha256:'.length )}`, import.meta.url ) ) );
assert.equal( `sha256:${createHash( 'sha256' ).update( bytes ).digest( 'hex' )}`, village.assetId );
const materialComponent = source.components.find( component => component.type === 'elsemesh.village-materials/2' );
assert.ok( materialComponent, 'the island package must include its portable village maps' );
const materialComponentData = materialComponent.data;
const materialAssetID = materialComponentData.dataAssetId;
const materialBytes = new Uint8Array( await readFile( new URL( `../assets/${materialAssetID.slice( 'sha256:'.length )}`, import.meta.url ) ) );
assert.equal( `sha256:${createHash( 'sha256' ).update( materialBytes ).digest( 'hex' )}`, materialAssetID );
const previewBytes = new Uint8Array( await readFile( new URL( `../assets/${previewObject.assetId.slice( 'sha256:'.length )}`, import.meta.url ) ) );
const materialData = await decodeVillageMaterialAsset( materialBytes );
assert.equal( materialData.metadata.protocol, 'elsemesh.village-material-data/1' );
assert.equal( materialData.metadata.rendererProfile, 'original-elsemesh-village-v1' );
const life = await setupLife( { W: 640, H: 480 } );
life.shadowsOn = false;
const materials = Object.fromEntries( VILLAGE_MATERIAL_ROLES.map( role => [ role, { name: role, userData: {}, dispose() { this.disposed = true; } } ] ) );
const materialContext = { materials, textures: { bake() {} } };
const assetIndex = [
	{ id: village.assetId, kind: 'glb', bytes: bytes.byteLength, priority: village.priority },
	{ id: previewObject.assetId, kind: 'glb', bytes: previewBytes.byteLength, priority: previewObject.priority },
	{ id: materialAssetID, kind: 'village-materials/1', bytes: materialBytes.byteLength, priority: materialComponent.priority },
];
const hydratedComponents = source.components.map( component => ( { ...component, ...component.data } ) );
const makeConnector = requiredFeatures => ( {
	worldId: source.worldId, manifest: { ...source, components: hydratedComponents, rules: { ...source.rules, requiredFeatures }, portals: [], assets: assetIndex },
	assets: new Map( [ [ village.assetId, bytes ], [ previewObject.assetId, previewBytes ], [ materialAssetID, materialBytes ] ] ),
	getAsset: async id => id === village.assetId ? bytes : id === previewObject.assetId ? previewBytes : id === materialAssetID ? materialBytes : null,
} );

let previewMapReads = 0;
const previewConnector = makeConnector( source.rules.requiredFeatures );
const previewGetAsset = previewConnector.getAsset;
previewConnector.getAsset = async id => {
	if ( id === materialAssetID ) previewMapReads ++;
	return previewGetAsset( id );
};
const previewRoot = await loadWorldPackage( previewConnector, { objectIDs: [ previewObject.id ], assets: new Map( [ [ previewObject.assetId, previewBytes ] ] ), materialContext } );
assert.equal( previewMapReads, 0, 'a portal preview must not fetch the village texture bundle' );
disposeWorldPackage( previewRoot );

await assert.rejects( loadWorldPackage( makeConnector( source.rules.requiredFeatures.filter( feature => feature !== 'elsemesh.village-materials/1' ) ), { objectIDs: [ village.id ], assets: new Map( [ [ village.assetId, bytes ] ] ), materialContext } ), /missing elsemesh.village-materials\/1/ );
const root = await loadWorldPackage( makeConnector( source.rules.requiredFeatures ), { objectIDs: [ village.id ], assets: new Map( [ [ village.assetId, bytes ] ] ), materialContext } );
const meshes = [];
root.traverse( object => { if ( object.isMesh ) meshes.push( object ); } );
assert.ok( meshes.length >= VILLAGE_MATERIAL_ROLES.length );
const roles = new Set();
for ( const mesh of meshes ) {
	if ( mesh.material.name === 'Procedural village net' ) {
		assert.equal( mesh.geometry.getAttribute( 'vdata' )?.itemSize, 4 );
		assert.equal( mesh.geometry.getAttribute( 'color' )?.itemSize, 3 );
		assert.match( mesh.material.surface, /emg_tintedAlbedo/, 'the package net is compiled by the generic engine material-graph path' );
		roles.add( 'net' );
		continue;
	}
	if ( ! mesh.material.userData?.borrowedWorldMaterial ) continue;
	assert.ok( mesh.geometry.getAttribute( 'vdata' )?.itemSize === 4 );
	assert.ok( mesh.geometry.getAttribute( 'color' )?.itemSize === 3 );
	assert.equal( mesh.geometry.getAttribute( 'tint' ), mesh.geometry.getAttribute( 'color' ), 'the original village shader consumes COLOR_0 as tint' );
	assert.ok( mesh.geometry.getAttribute( 'tint' ).array.some( value => value > 0 ), 'tint values must be uploaded instead of the shader default' );
	assert.ok( mesh.onBeforeRender );
	mesh.onBeforeRender();
	const roleName = mesh.material.name.replace( /^Village/, '' );
	roles.add( roleName[ 0 ].toLowerCase() + roleName.slice( 1 ) );
}
assert.ok( meshes.some( mesh => mesh.material.name === 'Procedural village net' && ! mesh.material.userData?.borrowedWorldMaterial ), 'net uses the ElseMesh-compiled graph path instead of a world-registered renderer material' );
assert.deepEqual( roles, new Set( VILLAGE_MATERIAL_ROLES ) );
const ownedContext = root.userData.worldPackage.materialAdapterContexts.get( 'elsemesh.village-materials/2' )?.context;
assert.ok( ownedContext?.textures?.baked, 'the renderer must use packaged maps instead of re-baking hidden project state' );
const map = await readTexture( ownedContext.textures.textures.woodA );
assert.deepEqual( new Uint8Array( map.data ), materialData.maps.woodA, 'the GPU texture must match the packaged level-zero bytes' );
const netMeshes = meshes.filter( mesh => mesh.material.name === 'Procedural village net' );
assert.equal( netMeshes.length, 1, 'signed village package contains one net graph batch' );
for ( const mesh of meshes ) mesh.visible = mesh === netMeshes[ 0 ];
life.scene.add( root );
const netCenter = netMeshes[ 0 ].getWorldPosition( new THREE.Vector3() );
const netRadius = Math.max( netMeshes[ 0 ].geometry.boundingSphere?.radius || 0, 1 );
life.camera.position.set( netCenter.x, netCenter.y, netCenter.z + netRadius * 2.5 );
life.camera.lookAt( netCenter );
await life.run( 3 );
const netPixels = new Uint8Array( ( await readTexture( life.ldr.texture ) ).data );
const background = netPixels.slice( 0, 3 );
let netChangedPixels = 0;
for ( let i = 0; i < netPixels.length; i += 4 ) {
	if ( Math.abs( netPixels[ i ] - background[ 0 ] ) + Math.abs( netPixels[ i + 1 ] - background[ 1 ] ) + Math.abs( netPixels[ i + 2 ] - background[ 2 ] ) > 24 ) netChangedPixels ++;
}
assert.ok( netChangedPixels > 30, `signed Tidewater net graph renders visible WebGPU pixels (${netChangedPixels})` );
disposeWorldPackage( root );
assert.ok( Object.values( materials ).every( material => ! material.disposed ), 'package cleanup must preserve App-owned procedural materials' );
GPU.device.destroy();
console.log( `Hosted island package passes and Tidewater net graph renders ${netChangedPixels} visible WebGPU pixels` );
