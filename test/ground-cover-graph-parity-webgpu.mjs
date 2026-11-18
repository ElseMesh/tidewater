import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { GPU } from '../../../src/engine/gpu/GPU.js';
import { Texture } from '../../../src/engine/gpu/Texture.js';
import { Group } from '../../../src/engine/scene/Group.js';
import { Mesh } from '../../../src/engine/scene/Mesh.js';
import { PlaneGeometry } from '../../../src/engine/geometry/PrimitiveGeometries.js';
import { standard } from '../../../src/materials/Materials.js';
import { worldComponentBackendAdapter } from '../../../src/network/WorldComponentBackendRegistry.js';
import '../../../src/network/WebGPUWorldComponentAdapters.js';
import { setupLife } from '../../../test/life-harness.mjs';
import { groundCoverFieldRenderFixture } from '../../../test/helpers/ground-cover-field-render-fixture.mjs';
import { GrassField } from '../renderers/webgpu-vegetation/GrassField.js';

const fixture = await groundCoverFieldRenderFixture();
const captureDir = process.env.ELSEMESH_GROUND_COVER_CAPTURE_DIR || null;
if ( captureDir ) await mkdir( captureDir, { recursive: true } );
const L = await setupLife( { W: 256, H: 192, shadowSplits: [ 12 ] } );
let original, runtime, detailTexture;
try {
	const ground = new Mesh( new PlaneGeometry( 32, 32 ).rotateX( - Math.PI / 2 ), standard( { name: 'tidewater-ground-cover-parity-ground', color: 0xc3b895, roughness: 1 } ) );
	ground.position.y = - 0.02;
	ground.receiveShadow = true;
	L.scene.add( ground );
	L.camera.position.set( 0, 3, 8 );
	L.camera.lookAt( 0, 0.5, 0 );

	// This is Tidewater's existing pre-migration WebGPU presenter. Hold its
	// geometry, placement, source density, terrain, camera, and frame time fixed.
	original = new GrassField( { terrain: fixture.terrain, mask: fixture.grassMask } );
	for ( const mesh of original.meshes ) L.scene.add( mesh );
	await L.run( 2, () => original.update( L.camera ), 0 );
	const reference = new Uint8Array( ( await readFrame() ).data );
	if ( captureDir ) await L.save( path.join( captureDir, 'source-webgpu.png' ) );
	const sourceCounts = original.levels.map( level => level.count );
	const sourceCells = original.levels.flatMap( level => Array.from( { length: level.count }, ( _, index ) => `${level.arr[ index * 4 ]},${level.arr[ index * 4 + 1 ]}` ) ).sort();
	for ( const mesh of original.meshes ) L.scene.remove( mesh );
	original.dispose();
	original = null;

	// Render the exported GLBs and the renderer-neutral graph in the same scene.
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
	runtime = installed.runtime;
	L.scene.add( root );
	const deadline = Date.now() + 10000;
	while ( ! runtime.isCoarseReadyForView() && Date.now() < deadline ) {
		await L.run( 1, () => runtime.update( 0, L.camera ), 0 );
		await new Promise( resolve => setTimeout( resolve, 10 ) );
	}
	assert.equal( runtime.isCoarseReadyForView(), true, 'the Tidewater graph LODs reach coarse coverage' );
	await L.run( 2, () => runtime.update( 0, L.camera ), 0 );
	const graphFrame = new Uint8Array( ( await readFrame() ).data );
	if ( captureDir ) await L.save( path.join( captureDir, 'graph-webgpu.png' ) );
	const graphMeshes = [];
	root.traverse( object => { if ( object.isInstancedMesh && ! object.userData.shadowOnly ) graphMeshes.push( object ); } );
	const graphCounts = graphMeshes.map( mesh => mesh.count );
	const graphCells = graphMeshes.flatMap( mesh => Array.from( { length: mesh.count }, ( _, index ) => `${mesh.instanceMatrix.array[ index * 16 + 12 ]},${mesh.instanceMatrix.array[ index * 16 + 14 ]}` ) ).sort();
	let totalError = 0, changedPixels = 0;
	for ( let offset = 0; offset < reference.length; offset += 4 ) {
		const difference = Math.abs( reference[ offset ] - graphFrame[ offset ] ) + Math.abs( reference[ offset + 1 ] - graphFrame[ offset + 1 ] ) + Math.abs( reference[ offset + 2 ] - graphFrame[ offset + 2 ] );
		totalError += difference;
		if ( difference > 24 ) changedPixels ++;
	}
	const meanAbsoluteError = totalError / ( reference.length / 4 * 3 );
	assert.ok( meanAbsoluteError <= 10, `the Tidewater material graph stays close to the source WebGPU presenter in the matched flat-field fixture (MAE ${ meanAbsoluteError.toFixed( 3 )}/255)` );
	console.log( `Tidewater WebGPU ground-cover graph versus source presenter: MAE ${ meanAbsoluteError.toFixed( 3 )}/255; ${ changedPixels } changed pixels; source LOD counts ${ sourceCounts.join( '/' ) }; graph LOD counts ${ graphCounts.join( '/' ) }; source cells ${ sourceCells.join( ';' ) }; graph cells ${ graphCells.join( ';' ) }` );
} finally {
	original?.dispose();
	runtime?.dispose();
	detailTexture?.destroy();
	GPU.device?.destroy();
}
await new Promise( resolve => setTimeout( resolve, 200 ) );

async function readFrame() {
	const { readTexture } = await import( '../../../src/engine/gpu/Readback.js' );
	return readTexture( L.ldr.texture );
}
