// Render the deterministic Tidewater fish-prop fixture with its native WebGPU material.
//   node worlds/tidewater/test/fish-props-webgpu-render.mjs [output.png]
import assert from 'node:assert/strict';
import '../../../test/headless.mjs';
import { setupLife } from '../../../test/life-harness.mjs';
import { readTexture } from '../../../src/engine/gpu/Readback.js';
import { FishProps } from '../fish/FishProps.js';
import * as fishPresentation from '../FishPresentation.js';
import { fishPropsRenderRecords } from './fish-props-render-records.js';

const output = process.argv[ 2 ] || '/var/tmp/elsemesh-tidewater-fish-props-webgpu.png';
const life = await setupLife( { W: 960, H: 600, fov: 34, near: 0.1, far: 80, shadowSplits: [] } );
const props = new FishProps( fishPresentation );
props.items = fishPropsRenderRecords( fishPresentation );
try {

	life.shadowsOn = false;
	life.sky = [ 0.009, 0.016, 0.026, 1 ];
	life.camera.position.set( 0, 4.1, 13.5 );
	life.camera.lookAt( 0, 0.15, - 0.8 );
	life.camera.updateProjectionMatrix();
	life.scene.add( props.build() );
	await life.run( 4 );
	const rendered = await readTexture( life.ldr.texture );
	const data = new Uint8Array( rendered.data );
	const background = data.slice( 0, 3 );
	let changedPixels = 0;
	for ( let offset = 0; offset < data.length; offset += 4 ) {
		if ( Math.abs( data[ offset ] - background[ 0 ] ) + Math.abs( data[ offset + 1 ] - background[ 1 ] ) + Math.abs( data[ offset + 2 ] - background[ 2 ] ) > 24 ) changedPixels ++;
	}
	assert( changedPixels > 500, `WebGPU fish-prop fixture renders visible pixels (${ changedPixels })` );
	await life.save( output );
	console.log( `Tidewater WebGPU fish-prop render passed (${ changedPixels } non-background pixels; ${ props.kind0.length } records); PNG ${ output }` );

} finally {

	props.mesh?.geometry.dispose();
	props.material?.dispose();
	props.fadeMaterial?.dispose();
	life.GPU.device.destroy();

}
