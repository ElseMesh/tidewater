import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { loadCanopyProductionPackage } from '../../../test/octahedral-canopy-production-package.mjs';
import { createWorldPackageRoot, disposeWorldPackage } from '../../../src/network/WorldPackage.js';
import { worldComponentBackendAdapter } from '../../../src/network/WorldComponentBackendRegistry.js';
import { OCTAHEDRAL_CANOPY_COMPONENT_TYPE } from '../../../src/network/OctahedralCanopyDescriptor.js';
import { Texture } from '../../../src/engine/gpu/Texture.js';
import { GPU } from '../../../src/engine/gpu/GPU.js';
import { setupLife } from '../../../test/life-harness.mjs';
import { Vegetation } from '../renderers/WebGPUVegetation.js';
import { TIDEWATER_LAYOUT } from '../layout.js';
import { TIDEWATER_CANOPY_PROFILE } from '../vegetation/CanopyProfile.js';

const exportDirectory = process.env.ELSEMESH_CANOPY_EXPORT;
const outputDirectory = path.resolve( process.argv[ 2 ] || '/var/tmp/elsemesh-canopy-webgpu-review' );
if ( ! exportDirectory ) throw new Error( 'Set ELSEMESH_CANOPY_EXPORT to the Tidewater exporter output directory' );
await mkdir( outputDirectory, { recursive: true } );

await import( '../../../src/network/WebGPUWorldComponentAdapters.js' );
const packageData = await loadCanopyProductionPackage( exportDirectory );
const life = await setupLife( {
	W: 1600,
	H: 900,
	ground: { center: [ 20, -160 ], size: 900, res: 2 },
	water: true,
	shadowSplits: [ 15, 80, 500 ],
} );
const vegetation = new Vegetation( { scene: life.scene, terrain: life.terrain, worldLayout: TIDEWATER_LAYOUT } );
const root = createWorldPackageRoot( packageData.connector );
const detailTexture = new Texture( {
	label: 'canopy-review-detail', width: 1, height: 1, format: 'rgba8unorm',
	data: Uint8Array.from( [ 96, 128, 144, 255 ] ), sampler: 'linearRepeat',
} );
root.userData.terrainData = life.terrain;
root.userData.worldComponents = [ { terrainSurface: true, terrainGPU: { detailTexture } } ];
life.scene.add( root );

let nearResult, farResult;
try {
	const nearAdapter = worldComponentBackendAdapter( 'webgpu', 'elsemesh.static-model-instance-set/1' );
	const farAdapter = worldComponentBackendAdapter( 'webgpu', OCTAHEDRAL_CANOPY_COMPONENT_TYPE );
	assert.equal( typeof nearAdapter, 'function' );
	assert.equal( typeof farAdapter, 'function' );
	nearResult = await nearAdapter( { root, connector: packageData.connector, installed: root.userData.worldComponents }, packageData.packageDocument.nearComponent );
	farResult = await farAdapter( { root, connector: packageData.connector }, packageData.component );

	const sourceTree = vegetation.records.trees.find( item => Math.hypot( item.x - packageData.target[ 0 ], item.z - packageData.target[ 2 ] ) < 0.001 );
	assert.ok( sourceTree, 'exported canopy target is present in the live Tidewater WebGPU placement records' );
	const canopyMeshes = vegetation.canopy.meshes;
	assert.ok( canopyMeshes.length > 0, 'current WebGPU canopy has drawable meshes for the matched baseline' );

	const nearDistance = TIDEWATER_CANOPY_PROFILE.lod.treeNearDistance;
	const views = [
		[ 'near', nearDistance * 0.55 ],
		[ 'transition-in', nearDistance * 0.94 ],
		[ 'transition-out', nearDistance * 1.06 ],
		[ 'far', nearDistance * 1.45 ],
	];

	for ( const [ name, distance ] of views ) {
		const position = [ packageData.target[ 0 ], packageData.target[ 1 ] + distance * 0.22, packageData.target[ 2 ] + distance * 0.976 ];
		life.camera.position.set( ...position );
		life.camera.lookAt( ...packageData.target );
		farResult.runtime.update( 1 / 60, life.camera );
		nearResult.runtime.update( 1 / 60, life.camera );
		const readyDeadline = Date.now() + 20000;
		while ( ! nearResult.runtime.isCoarseReadyForView() && Date.now() < readyDeadline ) {
			nearResult.runtime.update( 1 / 60, life.camera );
			await new Promise( resolve => setTimeout( resolve, 10 ) );
		}
		assert.equal( nearResult.runtime.isCoarseReadyForView(), true, `candidate near models become visible for ${name}` );

		for ( const mesh of canopyMeshes ) mesh.visible = true;
		root.visible = false;
		await life.run( 4, dt => vegetation.update( dt, life.camera ) );
		await life.save( path.join( outputDirectory, `tidewater-webgpu-original-${name}.png` ) );

		for ( const mesh of canopyMeshes ) mesh.visible = false;
		root.visible = true;
		await life.run( 4, dt => {
			vegetation.update( dt, life.camera );
			nearResult.runtime.update( dt, life.camera );
			farResult.runtime.update( dt, life.camera );
		} );
		await life.save( path.join( outputDirectory, `elsemesh-webgpu-candidate-${name}.png` ) );
		console.log( `${name}: camera distance ${distance.toFixed( 2 )} m, candidate near instances ${root.children.filter( item => item.isInstancedMesh && item.count > 0 ).length}` );
	}

	console.log( `Wrote matched original/candidate WebGPU canopy captures to ${outputDirectory}` );
} finally {
	nearResult?.runtime?.dispose();
	farResult?.runtime?.dispose();
	vegetation.dispose();
	root.parent?.remove( root );
	disposeWorldPackage( root );
	detailTexture.destroy();
	GPU.device?.destroy();
	await life.exit();
}
