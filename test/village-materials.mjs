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
import { TIDEWATER_NET_MATERIAL_GRAPH, TIDEWATER_THATCH_MATERIAL_GRAPH, TIDEWATER_FABRIC_MATERIAL_GRAPH, TIDEWATER_STONE_MATERIAL_GRAPH } from '../VillageMaterialGraphs.js';
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
const netGraphShader = { vertexShader: '#include <common>\n#include <begin_vertex>\n#include <defaultnormal_vertex>\n#include <worldpos_vertex>', fragmentShader: '#include <common>\n#include <alphatest_fragment>\n#include <lights_physical_fragment>', uniforms: {} };
webglNet.material.onBeforeCompile( netGraphShader );
assert.match( netGraphShader.vertexShader, /emgWindDirection/ );
assert.match( netGraphShader.fragmentShader, /texture2D\( emgTexture_metallicRoughness/ );
assert.match( netGraphShader.fragmentShader, /gl_FrontFacing \? 1\.0 : -1\.0/ );
assert.match( netGraphShader.fragmentShader, /vEmg_colorRGB \* emg_albedo/ );
webglNet.material.dispose();
netSourceMaterial.dispose();
netGraphTexture.dispose();

const thatchGraphWebGPU = compileWorldMaterialGraph( TIDEWATER_THATCH_MATERIAL_GRAPH, 'webgpu' );
const thatchGraphWebGL = compileWorldMaterialGraph( TIDEWATER_THATCH_MATERIAL_GRAPH, 'webgl' );
assert.deepEqual( new Set( thatchGraphWebGPU.textureSlots ), new Set( [ 'metallicRoughness', 'normal', 'occlusion' ] ) );
assert.match( thatchGraphWebGPU.surface, /s\.ao \*= emg_occlusion/ );
assert.match( thatchGraphWebGPU.surface, /perturbNormalByMap/ );
assert.match( thatchGraphWebGL.glsl.occlusion, /reflectedLight\.indirectDiffuse/ );
assert.match( thatchGraphWebGL.glsl.fragment, /texture2D\( emgTexture_occlusion/ );
const fabricGraphWebGPU = compileWorldMaterialGraph( TIDEWATER_FABRIC_MATERIAL_GRAPH, 'webgpu', { doubleSided: true } );
const fabricGraphWebGL = compileWorldMaterialGraph( TIDEWATER_FABRIC_MATERIAL_GRAPH, 'webgl', { doubleSided: true } );
assert.deepEqual( new Set( fabricGraphWebGPU.textureSlots ), new Set( [ 'metallicRoughness', 'occlusion' ] ) );
assert.match( fabricGraphWebGPU.vertex, /frame\.time/ );
assert.match( fabricGraphWebGPU.vertex, /frame\.windDir/ );
assert.match( fabricGraphWebGPU.surface, /s\.alpha \*= emg_fabricCoverage/ );
assert.match( fabricGraphWebGL.glsl.vertex, /emgWindDirection/ );
assert.match( fabricGraphWebGL.glsl.fragment, /gl_FrontFacing/ );
const stoneGraphWebGPU = compileWorldMaterialGraph( TIDEWATER_STONE_MATERIAL_GRAPH, 'webgpu' );
const stoneGraphWebGL = compileWorldMaterialGraph( TIDEWATER_STONE_MATERIAL_GRAPH, 'webgl' );
assert.deepEqual( new Set( stoneGraphWebGPU.textureSlots ), new Set( [ 'baseColor', 'normal', 'metallicRoughness', 'occlusion' ] ) );
assert.equal( stoneGraphWebGPU.samplesBaseColorForBaseColor, true, 'stone data sampled through the sRGB base-color slot replaces the ordinary base-color map path' );
assert.match( stoneGraphWebGPU.surface, /s\.ao \*= emg_surfaceAO/ );
assert.match( stoneGraphWebGL.glsl.occlusion, /reflectedLight\.indirectDiffuse/ );

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
	if ( mesh.material.name === 'Procedural village net' || mesh.material.surface?.includes( 'emg_streakAlbedo' ) || mesh.material.surface?.includes( 'emg_fabricAlbedo' ) || mesh.material.surface?.includes( 'emg_surfaceColor' ) ) {
		assert.equal( mesh.geometry.getAttribute( 'vdata' )?.itemSize, 4 );
		assert.equal( mesh.geometry.getAttribute( 'color' )?.itemSize, 3 );
		if ( mesh.material.name === 'Procedural village net' ) {
			assert.match( mesh.material.surface, /emg_tintedAlbedo/, 'the package net is compiled by the generic engine material-graph path' );
			roles.add( 'net' );
		} else if ( mesh.material.surface.includes( 'emg_streakAlbedo' ) ) {
			assert.match( mesh.material.surface, /s\.ao \*= emg_occlusion/, 'the packaged thatch graph uses the shared occlusion output' );
			roles.add( 'thatch' );
		} else if ( mesh.material.surface.includes( 'emg_fabricAlbedo' ) ) {
			assert.match( mesh.material.vertex, /emg_moved/, 'the packaged fabric graph carries its shared wind and flag movement' );
			assert.match( mesh.material.surface, /s\.alpha \*= emg_fabricCoverage/ );
			roles.add( 'fabric' );
		} else {
			assert.match( mesh.material.surface, /s\.ao \*= emg_surfaceAO/ );
			roles.add( 'stone' );
		}
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
life.scene.add( root );
const thatchMeshes = meshes.filter( mesh => mesh.material.surface?.includes( 'emg_streakAlbedo' ) );
assert.equal( thatchMeshes.length, 1, 'signed village package contains one engine-compiled thatch graph batch' );
const fabricMeshes = meshes.filter( mesh => mesh.material.surface?.includes( 'emg_fabricAlbedo' ) );
assert.ok( fabricMeshes.length > 0, 'signed village package contains engine-compiled cloth, net, or flag geometry' );
const stoneMeshes = meshes.filter( mesh => mesh.material.surface?.includes( 'emg_surfaceColor' ) );
assert.equal( stoneMeshes.length, 1, 'signed village package contains one engine-compiled stone graph batch' );
const focusGeometryCluster = mesh => {
	const geometry = mesh.geometry, index = geometry.index?.array, positions = geometry.getAttribute( 'position' )?.array, data = geometry.getAttribute( 'vdata' )?.array;
	if ( ! index || ! positions || ! data ) throw new Error( 'fabric render fixture requires indexed geometry, positions, and material data' );
	const cellSize = 4, cellFor = triangle => {
		if ( data[ index[ triangle ] * 4 + 2 ] <= 5000 ) return null;
		const center = [ 0, 1, 2 ].map( axis => ( positions[ index[ triangle ] * 3 + axis ] + positions[ index[ triangle + 1 ] * 3 + axis ] + positions[ index[ triangle + 2 ] * 3 + axis ] ) / 3 );
		return { center, key: center.map( value => Math.floor( value / cellSize ) ).join( ',' ) };
	};
	const bins = new Map();
	for ( let triangle = 0; triangle < index.length; triangle += 3 ) {
		const cell = cellFor( triangle );
		if ( ! cell ) continue;
		const { key } = cell;
		bins.set( key, ( bins.get( key ) || 0 ) + 1 );
	}
	const target = [ ...bins ].sort( ( a, b ) => b[ 1 ] - a[ 1 ] )[ 0 ]?.[ 0 ];
	const focused = [];
	for ( let triangle = 0; triangle < index.length; triangle += 3 ) if ( cellFor( triangle )?.key === target ) focused.push( index[ triangle ], index[ triangle + 1 ], index[ triangle + 2 ] );
	if ( focused.length < 30 ) throw new Error( 'fabric render fixture found no representative local triangle cluster' );
	geometry.setIndex( focused );
	geometry.computeBoundingSphere();
};
focusGeometryCluster( fabricMeshes[ 0 ] );
const renderMaterial = async mesh => {
	for ( const candidate of meshes ) candidate.visible = candidate === mesh;
	const bounds = new THREE.Box3().setFromObject( mesh );
	const center = bounds.getCenter( new THREE.Vector3() );
	const radius = Math.max( bounds.getSize( new THREE.Vector3() ).length() * 0.5, 0.1 );
	const viewDirection = new THREE.Vector3( 0, 0, 1 );
	if ( mesh === fabricMeshes[ 0 ] ) {
		const normals = mesh.geometry.getAttribute( 'normal' ).array;
		viewDirection.set( 0, 0, 0 );
		for ( let i = 0; i < normals.length; i += 3 ) viewDirection.add( new THREE.Vector3( normals[ i ], normals[ i + 1 ], normals[ i + 2 ] ) );
		viewDirection.normalize().applyQuaternion( mesh.getWorldQuaternion( new THREE.Quaternion() ) );
	}
	life.camera.position.copy( center ).addScaledVector( viewDirection, radius * 2.5 );
	life.camera.lookAt( center );
	await life.run( 3 );
	const pixels = new Uint8Array( ( await readTexture( life.ldr.texture ) ).data );
	const background = pixels.slice( 0, 3 );
	let changedPixels = 0;
	for ( let i = 0; i < pixels.length; i += 4 ) {
		if ( Math.abs( pixels[ i ] - background[ 0 ] ) + Math.abs( pixels[ i + 1 ] - background[ 1 ] ) + Math.abs( pixels[ i + 2 ] - background[ 2 ] ) > 24 ) changedPixels ++;
	}
	const role = mesh === netMeshes[ 0 ] ? 'net' : mesh === thatchMeshes[ 0 ] ? 'thatch' : mesh === stoneMeshes[ 0 ] ? 'stone' : 'fabric';
	assert.ok( changedPixels >= ( role === 'fabric' ? 1 : 30 ), `signed Tidewater ${role} graph renders visible WebGPU pixels (${changedPixels})` );
	return changedPixels;
};
const netChangedPixels = await renderMaterial( netMeshes[ 0 ] );
const thatchChangedPixels = await renderMaterial( thatchMeshes[ 0 ] );
const fabricChangedPixels = await renderMaterial( fabricMeshes[ 0 ] );
const stoneChangedPixels = await renderMaterial( stoneMeshes[ 0 ] );
disposeWorldPackage( root );
assert.ok( Object.values( materials ).every( material => ! material.disposed ), 'package cleanup must preserve App-owned procedural materials' );
GPU.device.destroy();
console.log( `Hosted island package passes; Tidewater net/thatch/fabric/stone graphs render ${netChangedPixels}/${thatchChangedPixels}/${fabricChangedPixels}/${stoneChangedPixels} visible WebGPU pixels` );
