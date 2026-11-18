import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GPU } from '../../../src/engine/gpu/GPU.js';
import { Texture } from '../../../src/engine/gpu/Texture.js';
import { Group } from '../../../src/engine/scene/Group.js';
import { Material } from '../../../src/engine/render/Material.js';
import { ShaderModule } from '../../../src/engine/gpu/Shader.js';
import { TerrainGPU } from '../../../src/world/TerrainGPU.js';
import { Terrain } from '../../../src/world/Terrain.js';
import { HeightfieldTerrainData } from '../../../src/world/HeightfieldTerrainData.js';
import { decodeGrassDensityAsset } from '../../../src/network/GrassDensityAsset.js';
import { decodeTerrainSurfaceAsset } from '../../../src/network/TerrainSurfaceAsset.js';
import { worldComponentBackendAdapter } from '../../../src/network/WorldComponentBackendRegistry.js';
import '../../../src/network/WebGPUWorldComponentAdapters.js';
import { setupLife } from '../../../test/life-harness.mjs';
import { groundCoverFieldRenderFixture } from '../../../test/helpers/ground-cover-field-render-fixture.mjs';
import { GrassField } from '../renderers/webgpu-vegetation/GrassField.js';
import { uCamPos } from '../renderers/webgpu-vegetation/VegNodes.js';

const worldRoot = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' );
const assetRoot = process.env.ELSEMESH_TIDEWATER_ASSET_DIR || path.join( worldRoot, 'assets' );
const worldSource = JSON.parse( await readFile( path.join( worldRoot, 'world-source.json' ), 'utf8' ) );
const assetBytes = async assetId => {
	const bytes = new Uint8Array( await readFile( path.join( assetRoot, assetId.slice( 'sha256:'.length ) ) ) );
	assert.equal( createHash( 'sha256' ).update( bytes ).digest( 'hex' ), assetId.slice( 'sha256:'.length ), `signed asset ${assetId} matches its content hash` );
	return bytes;
};
const vegetation = worldSource.components.find( component => component.type === 'elsemesh.static-vegetation/1' );
const terrainComponent = worldSource.components.find( component => component.type === 'elsemesh.terrain-surface/1' );
assert.ok( vegetation?.data?.grassMaskAssetId && terrainComponent?.data?.dataAssetId, 'Tidewater declares its authored vegetation density and terrain surface' );
const [ densityBytes, terrainBytes ] = await Promise.all( [ assetBytes( vegetation.data.grassMaskAssetId ), assetBytes( terrainComponent.data.dataAssetId ) ] );
const density = decodeGrassDensityAsset( densityBytes );
const terrainMaps = await decodeTerrainSurfaceAsset( terrainBytes );
const terrain = new HeightfieldTerrainData( terrainMaps );
const captureDir = process.env.ELSEMESH_GROUND_COVER_CAPTURE_DIR || null;
if ( captureDir ) await mkdir( captureDir, { recursive: true } );
const L = await setupLife( { W: 256, H: 192, shadowSplits: [ 12 ] } );
let original, runtime, detailTexture, terrainGPU, terrainSurface;
try {
	terrainGPU = new TerrainGPU( terrain, terrainMaps.shoreField, { normal: terrainMaps.normal, splat: terrainMaps.splat, detailWidth: terrainMaps.detailWidth, detailHeight: terrainMaps.detailHeight, detail: terrainMaps.detail } );
	terrainSurface = new Terrain( { scene: L.scene, terrainData: terrain, terrainGPU, surfaceProfile: terrainComponent.data.surfaceProfile } );
	const viewX = - 52, viewZ = - 184, viewY = terrain.heightAt( viewX, viewZ );
	L.camera.position.set( viewX, viewY + 20, viewZ );
	L.camera.lookAt( viewX, viewY, viewZ );
	await L.run( 2, () => terrainSurface.update( L.camera, true ), 0 );
	await GPU.pipelinesReady();
	await L.run( 2, () => terrainSurface.update( L.camera, true ), 0 );
	terrainSurface.mesh.visible = false;
	await L.run( 1, () => terrainSurface.update( L.camera, true ), 0 );
	const emptyFrame = new Uint8Array( ( await readFrame() ).data );

	// This is Tidewater's existing pre-migration WebGPU presenter. Hold its
	// geometry, placement, signed density, packaged terrain, camera, and frame time fixed.
	original = new GrassField( { terrain, mask: density } );
	for ( const mesh of original.meshes ) L.scene.add( mesh );
	await L.run( 2, () => { uCamPos.value.copy( L.camera.position ); terrainSurface.update( L.camera, true ); original.update( L.camera ); }, 0 );
	await GPU.pipelinesReady();
	await L.run( 2, () => { uCamPos.value.copy( L.camera.position ); terrainSurface.update( L.camera, true ); original.update( L.camera ); }, 0 );
	const reference = new Uint8Array( ( await readFrame() ).data );
	const sourceForegroundPixels = countForegroundPixels( reference );
	const sourceChangedPixels = changedPixelsFrom( reference, emptyFrame );
	if ( captureDir ) await L.save( path.join( captureDir, 'source-webgpu.png' ) );
	const sourceCounts = original.levels.map( level => level.count );
	const sourceCells = original.levels.flatMap( level => Array.from( { length: level.count }, ( _, index ) => `${level.arr[ index * 4 ]},${level.arr[ index * 4 + 1 ]}` ) ).sort();
	for ( const mesh of original.meshes ) L.scene.remove( mesh );
	original.dispose();
	original = null;

	// Render the exported GLBs and the renderer-neutral graph in the same scene.
	const graphTerrainHeightModule = process.env.ELSEMESH_GROUND_COVER_FLAT_HEIGHT === '1'
		? new ShaderModule( { name: 'groundCoverParityFlatTerrainHeight', code: 'fn terrainHeightAt( xz: vec2f ) -> f32 { return 8.0; }' } )
		: terrainGPU.heightModule;
	const fixture = await groundCoverFieldRenderFixture( {
		density,
		terrain,
		terrainHeightModule: graphTerrainHeightModule,
		terrainDetail: { width: terrainMaps.detailWidth, height: terrainMaps.detailHeight, data: terrainMaps.detail },
		graphPositionOnly: process.env.ELSEMESH_GROUND_COVER_POSITION_ONLY === '1',
	} );
	detailTexture = new Texture( { label: 'tidewater-ground-cover-parity-detail', width: fixture.terrainDetail.width, height: fixture.terrainDetail.height, format: 'rgba8unorm', data: fixture.terrainDetail.data, sampler: 'aniso4Repeat' } );
	const root = new Group();
	root.userData.terrainData = fixture.terrain;
	root.userData.worldComponents = [ { terrainSurface: true, terrainGPU: { detailTexture, heightModule: fixture.terrainHeightModule } } ];
	root.userData.worldPackage = { parsed: new Map(), loadedObjects: new Set(), connector: fixture.connector, progressiveController: new AbortController() };
	const component = {
		...fixture.component,
		data: { ...fixture.component.data, species: [ { ...fixture.component.data.species[ 0 ], castsShadow: false, shadowMaxDistance: 0 } ] },
	};
	const installed = await worldComponentBackendAdapter( 'webgpu', component.type )( { app: {}, root, connector: fixture.connector }, component );
	assert.equal( installed?.installed, true, 'Tidewater patch GLBs install through the generic WebGPU ground-cover adapter' );
	if ( process.env.ELSEMESH_GROUND_COVER_FORCE_DENSITY === '1' ) {
		const texture = root.userData.worldPackage.textureAssets.get( `component:${component.id}:densityField` )?.texture;
		assert.ok( texture, 'the signed density graph binding is available for the occupancy diagnostic' );
		texture.upload( new Uint8Array( fixture.density.res * fixture.density.res * 4 ).fill( 255 ) );
	}
	runtime = installed.runtime;
	L.scene.add( root );
	const deadline = Date.now() + 10000;
	while ( ! runtime.isCoarseReadyForView() && Date.now() < deadline ) {
	await L.run( 1, () => { terrainSurface.update( L.camera, true ); runtime.update( 0, L.camera ); }, 0 );
		await new Promise( resolve => setTimeout( resolve, 10 ) );
	}
	assert.equal( runtime.isCoarseReadyForView(), true, 'the Tidewater graph LODs reach coarse coverage' );
	await L.run( 2, () => { terrainSurface.update( L.camera, true ); runtime.update( 0, L.camera ); }, 0 );
	await GPU.pipelinesReady();
	await L.run( 2, () => { terrainSurface.update( L.camera, true ); runtime.update( 0, L.camera ); }, 0 );
	const graphFrame = new Uint8Array( ( await readFrame() ).data );
	const graphForegroundPixels = countForegroundPixels( graphFrame );
	const graphChangedPixels = changedPixelsFrom( graphFrame, emptyFrame );
	if ( captureDir ) await L.save( path.join( captureDir, 'graph-webgpu.png' ) );
	const graphMeshes = [];
	root.traverse( object => { if ( object.isInstancedMesh && ! object.userData.shadowOnly ) graphMeshes.push( object ); } );
	const graphCounts = graphMeshes.map( mesh => mesh.count );
	const graphCells = graphMeshes.flatMap( mesh => Array.from( { length: mesh.count }, ( _, index ) => `${mesh.instanceMatrix.array[ index * 16 + 12 ]},${mesh.instanceMatrix.array[ index * 16 + 14 ]}` ) ).sort();
	assert.ok( graphCells.length > 0, 'the generic Tidewater graph renders visible ground-cover instances from the signed density field' );
	const originalMaterials = graphMeshes.map( mesh => mesh.material );
	const geometryDiagnosticMaterial = new Material( { name: 'ground-cover-geometry-diagnostic', lit: false, side: 'double', output: 'r.color = vec4f( 0.0, 1.0, 0.0, 1.0 );' } );
	for ( const mesh of graphMeshes ) mesh.material = geometryDiagnosticMaterial;
	await L.run( 2, () => { terrainSurface.update( L.camera, true ); runtime.update( 0, L.camera ); }, 0 );
	await GPU.pipelinesReady();
	await L.run( 2, () => { terrainSurface.update( L.camera, true ); runtime.update( 0, L.camera ); }, 0 );
	const geometryDiagnostic = new Uint8Array( ( await readFrame() ).data );
	const graphGeometryPixels = changedPixelsFrom( geometryDiagnostic, emptyFrame );
	if ( captureDir ) await L.save( path.join( captureDir, 'graph-geometry-only.png' ) );
	for ( let index = 0; index < graphMeshes.length; index ++ ) graphMeshes[ index ].material = originalMaterials[ index ];
	geometryDiagnosticMaterial.dispose();
	let totalError = 0, changedPixels = 0;
	for ( let offset = 0; offset < reference.length; offset += 4 ) {
		const difference = Math.abs( reference[ offset ] - graphFrame[ offset ] ) + Math.abs( reference[ offset + 1 ] - graphFrame[ offset + 1 ] ) + Math.abs( reference[ offset + 2 ] - graphFrame[ offset + 2 ] );
		totalError += difference;
		if ( difference > 24 ) changedPixels ++;
	}
	const meanAbsoluteError = totalError / ( reference.length / 4 * 3 );
	console.log( `Tidewater signed ground-cover diagnostic: source/graph MAE ${ meanAbsoluteError.toFixed( 3 )}/255; changed pixels ${changedPixels}; foliage pixels beyond empty background ${sourceChangedPixels}/${graphChangedPixels}; geometry-only graph pixels ${graphGeometryPixels}; foreground pixels ${sourceForegroundPixels}/${graphForegroundPixels}; visible instance counts ${sourceCounts.join( '/' )}/${graphCounts.join( '/' )}` );
	assert.ok( meanAbsoluteError <= 10, `the Tidewater material graph stays close to the source WebGPU presenter with signed density and terrain assets (MAE ${ meanAbsoluteError.toFixed( 3 )}/255)` );
	console.log( `Tidewater WebGPU ground-cover source/graph selected cells: ${ sourceCells.length }/${ graphCells.length }; source LOD ${ sourceCounts.join( '/' ) }; graph LOD ${ graphCounts.join( '/' ) }` );
} finally {
	original?.dispose();
	runtime?.dispose();
	detailTexture?.destroy();
	if ( terrainSurface ) { L.scene.remove( terrainSurface.mesh ); terrainSurface.mesh.geometry.dispose(); terrainSurface.mesh.material.dispose(); }
	terrainGPU?.dispose();
	GPU.device?.destroy();
}
await new Promise( resolve => setTimeout( resolve, 200 ) );

async function readFrame() {
	const { readTexture } = await import( '../../../src/engine/gpu/Readback.js' );
	return readTexture( L.ldr.texture );
}

function countForegroundPixels( pixels ) {
	let count = 0;
	for ( let offset = 4; offset < pixels.length; offset += 4 ) if ( pixels[ offset ] !== pixels[ 0 ] || pixels[ offset + 1 ] !== pixels[ 1 ] || pixels[ offset + 2 ] !== pixels[ 2 ] ) count ++;
	return count;
}

function changedPixelsFrom( pixels, reference ) {
	let count = 0;
	for ( let offset = 0; offset < pixels.length; offset += 4 ) if ( Math.abs( pixels[ offset ] - reference[ offset ] ) + Math.abs( pixels[ offset + 1 ] - reference[ offset + 1 ] ) + Math.abs( pixels[ offset + 2 ] - reference[ offset + 2 ] ) > 24 ) count ++;
	return count;
}
