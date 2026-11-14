import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../../../test/headless.mjs';
import '../../../test/smaa-shim.mjs';
import { setupLife } from '../../../test/life-harness.mjs';
import '../register-behavior.js';
import { GPU } from '../../../src/engine/gpu/GPU.js';
import { readTexture } from '../../../src/engine/gpu/Readback.js';
import { loadWorldPackage, disposeWorldPackage } from '../../../src/network/WorldPackage.js';
import { VILLAGE_MATERIAL_ROLES } from '../VillageMaterialProfile.js';
import { TIDEWATER_NET_MATERIAL_GRAPH, TIDEWATER_WOOD_MATERIAL_GRAPH, TIDEWATER_THATCH_MATERIAL_GRAPH, TIDEWATER_FABRIC_MATERIAL_GRAPH, TIDEWATER_STONE_MATERIAL_GRAPH, TIDEWATER_ROOF_METAL_MATERIAL_GRAPH, TIDEWATER_HARD_MATERIAL_GRAPH, TIDEWATER_GLASS_MATERIAL_GRAPH } from '../VillageMaterialGraphs.js';
import { createGlassMaterial, createHardMaterial, createRoofMetalMaterial, createWoodMaterial } from '../renderers/webgpu-village/VillageMaterials.js';
import { createWebGLMaterialGraph } from '../../../src/materials/WorldMaterialGraph.js';
import { compileWorldMaterialGraph } from '../../../src/materials/WorldMaterialGraphCompiler.js';
import { Batch } from '../village/GeoBuilder.js';

const vertexColorBatch = new Batch();
vertexColorBatch.add( {
	p: [ 0, 0, 0, 1, 0, 0, 0, 1, 0 ],
	n: [ 0, 0, 1, 0, 0, 1, 0, 0, 1 ],
	uv: [ 0, 0, 1, 0, 0, 1 ],
	idx: [ 0, 1, 2 ]
}, new THREE.Matrix4(), [ 0.2, 0.4, 0.8 ], [ 0, 0, 0, 0 ] );
const vertexColorGeometry = vertexColorBatch.build();
assert.deepEqual( [ ...vertexColorGeometry.getAttribute( 'color' ).array ], [ 0.2, 0.4, 0.8, 0.2, 0.4, 0.8, 0.2, 0.4, 0.8 ], 'procedural batches expose authored tints through the standard graph color input' );
assert.equal( vertexColorGeometry.getAttribute( 'tint' ), undefined, 'procedural geometry uses the renderer-neutral standard color attribute' );
vertexColorGeometry.dispose();

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

const woodGraphWebGPU = compileWorldMaterialGraph( TIDEWATER_WOOD_MATERIAL_GRAPH, 'webgpu' );
const woodGraphWebGL = compileWorldMaterialGraph( TIDEWATER_WOOD_MATERIAL_GRAPH, 'webgl' );
assert.ok( TIDEWATER_WOOD_MATERIAL_GRAPH.nodes.length > 512 && TIDEWATER_WOOD_MATERIAL_GRAPH.nodes.length <= 1024 );
assert.deepEqual( new Set( woodGraphWebGPU.textureSlots ), new Set( [ 'baseColor', 'metallicRoughness', 'normal', 'emissive' ] ) );
assert.match( woodGraphWebGPU.surface, /emg_woodWet/ );
assert.match( woodGraphWebGPU.surface, /emg_woodBirdK/ );
assert.match( woodGraphWebGPU.surface, /emg_woodWalkK/ );
assert.match( woodGraphWebGL.glsl.fragment, /emgTexture_emissive/ );
assert.match( woodGraphWebGL.glsl.fragment, /emg_woodWet/ );
const builtInWoodGraphMaterial = createWoodMaterial( { woodA: {}, woodN: {}, paintN: {}, grime: {} } );
assert.match( builtInWoodGraphMaterial.surface, /emg_woodWet/, 'built-in WebGPU wood uses the same renderer-neutral graph as the hosted material' );

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
const roofMetalGraphWebGPU = compileWorldMaterialGraph( TIDEWATER_ROOF_METAL_MATERIAL_GRAPH, 'webgpu' );
const roofMetalGraphWebGL = compileWorldMaterialGraph( TIDEWATER_ROOF_METAL_MATERIAL_GRAPH, 'webgl' );
assert.deepEqual( new Set( roofMetalGraphWebGPU.textureSlots ), new Set( [ 'metallicRoughness', 'normal', 'occlusion' ] ) );
assert.match( roofMetalGraphWebGPU.surface, /s\.metalness = emg_metalness/ );
assert.match( roofMetalGraphWebGPU.surface, /surfaceNormal/ );
assert.match( roofMetalGraphWebGL.glsl.fragment, /emgTexture_metallicRoughness/ );
assert.match( roofMetalGraphWebGL.glsl.occlusion, /reflectedLight\.indirectDiffuse/ );
const builtInRoofMaterial = createRoofMetalMaterial( { roofA: {}, roofN: {}, hardN: {} } );
assert.match( builtInRoofMaterial.surface, /s\.metalness = emg_metalness/, 'the built-in WebGPU village binds the same graph as hosted GLBs' );
const hardGraphWebGPU = compileWorldMaterialGraph( TIDEWATER_HARD_MATERIAL_GRAPH, 'webgpu' );
const hardGraphWebGL = compileWorldMaterialGraph( TIDEWATER_HARD_MATERIAL_GRAPH, 'webgl' );
assert.deepEqual( new Set( hardGraphWebGPU.textureSlots ), new Set( [ 'metallicRoughness', 'normal', 'occlusion', 'emissive' ] ) );
assert.match( hardGraphWebGPU.surface, /s\.metalness = emg_metalness/ );
assert.match( hardGraphWebGPU.surface, /s\.ao \*= emg_occlusion/ );
assert.match( hardGraphWebGL.glsl.occlusion, /reflectedLight\.indirectDiffuse/ );
const builtInHardMaterial = createHardMaterial( { hardA: {}, hardN: {}, rope: {}, grime: {} } );
assert.match( builtInHardMaterial.surface, /s\.metalness = emg_metalness/, 'the built-in WebGPU hardware and rope bind the shared graph' );
const glassGraphWebGPU = compileWorldMaterialGraph( TIDEWATER_GLASS_MATERIAL_GRAPH, 'webgpu' );
const glassGraphWebGL = compileWorldMaterialGraph( TIDEWATER_GLASS_MATERIAL_GRAPH, 'webgl' );
assert.deepEqual( glassGraphWebGPU.textureSlots, [ 'emissive' ] );
assert.match( glassGraphWebGPU.surface, /frame\.night/ );
assert.match( glassGraphWebGPU.surface, /frame\.time/ );
assert.match( glassGraphWebGPU.surface, /s\.emissive \+=/ );
assert.match( glassGraphWebGL.glsl.fragment, /emgNight/ );
assert.match( glassGraphWebGL.glsl.fragment, /emgFrameTime/ );
assert.match( glassGraphWebGL.glsl.fragment, /totalEmissiveRadiance \+=/ );
const builtInGlassMaterial = createGlassMaterial( { grime: {} } );
assert.match( builtInGlassMaterial.surface, /s\.emissive \+=/, 'built-in WebGPU glass uses the shared renderer-neutral graph' );

const packageDirectory = path.resolve( process.argv[ 2 ] || fileURLToPath( new URL( '..', import.meta.url ) ) );
const source = JSON.parse( await readFile( path.join( packageDirectory, 'world-source.json' ) ) );
const village = source.objects.find( object => object.id === 'elsemesh-object:island-village' );
const previewObject = source.objects.find( object => object.priority === 'portal-preview' && object.id !== village.id );
const bytes = new Uint8Array( await readFile( path.join( packageDirectory, 'assets', village.assetId.slice( 'sha256:'.length ) ) ) );
assert.equal( `sha256:${createHash( 'sha256' ).update( bytes ).digest( 'hex' )}`, village.assetId );
assert.equal( source.components.some( component => component.type.startsWith( 'elsemesh.village-materials/' ) ), false, 'the signed GLB carries wood maps without a Tidewater material component' );
assert.equal( source.rules.requiredFeatures.some( feature => feature.startsWith( 'elsemesh.village-materials/' ) ), false, 'village appearance does not require a Tidewater renderer feature' );
const previewBytes = new Uint8Array( await readFile( path.join( packageDirectory, 'assets', previewObject.assetId.slice( 'sha256:'.length ) ) ) );
const life = await setupLife( { W: 640, H: 480 } );
life.shadowsOn = false;
const assetIndex = [
	{ id: village.assetId, kind: 'glb', bytes: bytes.byteLength, priority: village.priority },
	{ id: previewObject.assetId, kind: 'glb', bytes: previewBytes.byteLength, priority: previewObject.priority },
];
const hydratedComponents = source.components.map( component => ( { ...component, ...component.data } ) );
const makeConnector = () => ( {
	worldId: source.worldId, manifest: { ...source, components: hydratedComponents, portals: [], assets: assetIndex },
	assets: new Map( [ [ village.assetId, bytes ], [ previewObject.assetId, previewBytes ] ] ),
	getAsset: async id => id === village.assetId ? bytes : id === previewObject.assetId ? previewBytes : null,
} );
let villageAssetReads = 0;
const previewConnector = makeConnector();
const previewGetAsset = previewConnector.getAsset;
previewConnector.getAsset = async id => {
	if ( id === village.assetId ) villageAssetReads ++;
	return previewGetAsset( id );
};
const previewRoot = await loadWorldPackage( previewConnector, { objectIDs: [ previewObject.id ], assets: new Map( [ [ previewObject.assetId, previewBytes ] ] ) } );
assert.equal( villageAssetReads, 0, 'a portal preview does not fetch the village material GLB' );
disposeWorldPackage( previewRoot );
const root = await loadWorldPackage( makeConnector(), { objectIDs: [ village.id ], assets: new Map( [ [ village.assetId, bytes ] ] ) } );
const meshes = [];
root.traverse( object => { if ( object.isMesh ) meshes.push( object ); } );
assert.ok( meshes.length >= VILLAGE_MATERIAL_ROLES.length );
const roles = new Set();
for ( const mesh of meshes ) {
	const surface = mesh.material.surface || '';
	if ( surface.includes( 'emg_woodAlbedoBarn' ) ) {
		assert.equal( mesh.geometry.getAttribute( 'vdata' )?.itemSize, 4 );
		assert.equal( mesh.geometry.getAttribute( 'color' )?.itemSize, 3 );
		assert.match( surface, /emg_woodRoughClamped/ );
		roles.add( 'wood' );
	} else if ( mesh.material.name === 'Procedural village net' || mesh.material.name.endsWith( 'hard' ) || mesh.material.name === 'Procedural village roofMetal' || mesh.material.name.toLowerCase().includes( 'glass' ) || surface.includes( 'emg_streakAlbedo' ) || surface.includes( 'emg_fabricAlbedo' ) || surface.includes( 'emg_surfaceColor' ) ) {
		assert.equal( mesh.geometry.getAttribute( 'vdata' )?.itemSize, 4 );
		assert.equal( mesh.geometry.getAttribute( 'color' )?.itemSize, 3 );
		if ( mesh.material.name === 'Procedural village net' ) {
			assert.match( surface, /emg_tintedAlbedo/, 'the package net is compiled by the generic engine material-graph path' );
			roles.add( 'net' );
		} else if ( surface.includes( 'emg_streakAlbedo' ) ) {
			assert.match( surface, /s\.ao \*= emg_occlusion/, 'the packaged thatch graph uses the shared occlusion output' );
			roles.add( 'thatch' );
		} else if ( surface.includes( 'emg_fabricAlbedo' ) ) {
			assert.match( mesh.material.vertex, /emg_moved/, 'the packaged fabric graph carries its shared wind and flag movement' );
			assert.match( surface, /s\.alpha \*= emg_fabricCoverage/ );
			roles.add( 'fabric' );
		} else if ( mesh.material.name === 'Procedural village roofMetal' ) {
			assert.match( surface, /s\.metalness = emg_metalness/, 'the roof graph carries authored metalness into both engine backends' );
			roles.add( 'roofMetal' );
		} else if ( mesh.material.name.endsWith( 'hard' ) ) {
			assert.match( surface, /s\.ao \*= emg_occlusion/, 'the hardware and rope graph carries its authored AO data' );
			roles.add( 'hard' );
		} else if ( mesh.material.name.toLowerCase().includes( 'glass' ) ) {
			assert.match( surface, /s\.emissive \+=/, 'window and lantern glass compile the same graph through the engine' );
			roles.add( 'glass' );
		} else {
			assert.match( surface, /s\.ao \*= emg_surfaceAO/ );
			roles.add( 'stone' );
		}
	}
}
assert.deepEqual( roles, new Set( VILLAGE_MATERIAL_ROLES ) );
const netMeshes = meshes.filter( mesh => mesh.material.name === 'Procedural village net' );
assert.equal( netMeshes.length, 1, 'signed village package contains one net graph batch' );
life.scene.add( root );
const thatchMeshes = meshes.filter( mesh => mesh.material.surface?.includes( 'emg_streakAlbedo' ) );
assert.equal( thatchMeshes.length, 1, 'signed village package contains one engine-compiled thatch graph batch' );
const fabricMeshes = meshes.filter( mesh => mesh.material.surface?.includes( 'emg_fabricAlbedo' ) );
assert.ok( fabricMeshes.length > 0, 'signed village package contains engine-compiled cloth, net, or flag geometry' );
const stoneMeshes = meshes.filter( mesh => mesh.material.name === 'Procedural village stone' );
assert.equal( stoneMeshes.length, 1, 'signed village package contains one engine-compiled stone graph batch' );
const roofMetalMeshes = meshes.filter( mesh => mesh.material.name === 'Procedural village roofMetal' );
assert.equal( roofMetalMeshes.length, 1, 'signed village package contains one engine-compiled roof-metal graph batch' );
const hardMeshes = meshes.filter( mesh => mesh.material.name.endsWith( 'hard' ) );
const glassMeshes = meshes.filter( mesh => mesh.material.name.toLowerCase().includes( 'glass' ) );
const woodMeshes = meshes.filter( mesh => mesh.material.surface?.includes( 'emg_woodAlbedoBarn' ) );
assert.ok( hardMeshes.length >= 1, 'signed village package contains engine-compiled hardware and rope graph batches' );
assert.equal( woodMeshes.length, 2, 'signed village package contains engine-compiled building and sign wood graph batches' );
const focusGeometryCluster = ( mesh, { flagOnly = false } = {} ) => {
	const geometry = mesh.geometry, index = geometry.index?.array, positions = geometry.getAttribute( 'position' )?.array, data = geometry.getAttribute( 'vdata' )?.array;
	if ( ! index || ! positions || ! data ) throw new Error( 'material render fixture requires indexed geometry, positions, and material data' );
	const cellSize = 4, cellFor = triangle => {
		if ( flagOnly && data[ index[ triangle ] * 4 + 2 ] <= 5000 ) return null;
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
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();
};
focusGeometryCluster( fabricMeshes[ 0 ], { flagOnly: true } );
focusGeometryCluster( woodMeshes[ 0 ] );
const renderMaterial = async mesh => {
	for ( const candidate of meshes ) candidate.visible = candidate === mesh;
	const bounds = new THREE.Box3().setFromObject( mesh );
	const center = bounds.getCenter( new THREE.Vector3() );
	const radius = Math.max( bounds.getSize( new THREE.Vector3() ).length() * 0.5, 0.1 );
	const viewDirection = new THREE.Vector3( 0, 0, 1 );
	const cameraDistance = radius * 2.5;
	if ( mesh === fabricMeshes[ 0 ] || mesh === hardMeshes[ 0 ] ) {
		const normals = mesh.geometry.getAttribute( 'normal' );
		const indices = mesh.geometry.index?.array;
		viewDirection.set( 0, 0, 0 );
		if ( indices ) {
			for ( const index of indices ) viewDirection.add( new THREE.Vector3().fromBufferAttribute( normals, index ) );
		} else {
			for ( let i = 0; i < normals.count; i ++ ) viewDirection.add( new THREE.Vector3().fromBufferAttribute( normals, i ) );
		}
		viewDirection.normalize().applyQuaternion( mesh.getWorldQuaternion( new THREE.Quaternion() ) );
	}
	life.camera.position.copy( center ).addScaledVector( viewDirection, cameraDistance );
	life.camera.lookAt( center );
	await life.run( 3 );
	const pixels = new Uint8Array( ( await readTexture( life.ldr.texture ) ).data );
	const background = pixels.slice( 0, 3 );
	let changedPixels = 0;
	for ( let i = 0; i < pixels.length; i += 4 ) {
		if ( Math.abs( pixels[ i ] - background[ 0 ] ) + Math.abs( pixels[ i + 1 ] - background[ 1 ] ) + Math.abs( pixels[ i + 2 ] - background[ 2 ] ) > 24 ) changedPixels ++;
	}
	const role = mesh === netMeshes[ 0 ] ? 'net' : mesh === thatchMeshes[ 0 ] ? 'thatch' : mesh === stoneMeshes[ 0 ] ? 'stone' : mesh === roofMetalMeshes[ 0 ] ? 'roofMetal' : mesh === hardMeshes[ 0 ] ? 'hard' : mesh === glassMeshes[ 0 ] ? 'glass' : mesh === woodMeshes[ 0 ] ? 'wood' : 'fabric';
	assert.ok( changedPixels >= ( role === 'fabric' ? 1 : 30 ), `signed Tidewater ${role} graph renders visible WebGPU pixels (${changedPixels})` );
	return changedPixels;
};
const netChangedPixels = await renderMaterial( netMeshes[ 0 ] );
const thatchChangedPixels = await renderMaterial( thatchMeshes[ 0 ] );
const fabricChangedPixels = await renderMaterial( fabricMeshes[ 0 ] );
const stoneChangedPixels = await renderMaterial( stoneMeshes[ 0 ] );
const roofMetalChangedPixels = await renderMaterial( roofMetalMeshes[ 0 ] );
const hardChangedPixels = await renderMaterial( hardMeshes[ 0 ] );
const glassChangedPixels = await renderMaterial( glassMeshes[ 0 ] );
const woodChangedPixels = await renderMaterial( woodMeshes[ 0 ] );
assert.ok( glassChangedPixels >= 30, `signed Tidewater glass graph renders visible WebGPU pixels (${glassChangedPixels})` );
assert.ok( woodChangedPixels >= 30, `signed Tidewater wood graph renders visible WebGPU pixels (${woodChangedPixels})` );
disposeWorldPackage( root );
GPU.device.destroy();
console.log( `Hosted island package passes; Tidewater net/thatch/fabric/stone/roof-metal/hard/glass/wood graphs render ${netChangedPixels}/${thatchChangedPixels}/${fabricChangedPixels}/${stoneChangedPixels}/${roofMetalChangedPixels}/${hardChangedPixels}/${glassChangedPixels}/${woodChangedPixels} visible WebGPU pixels` );
