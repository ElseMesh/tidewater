import * as THREE from 'three';
import * as fishPresentation from '../FishPresentation.js';
import { WebGLFishPropsAdapter } from '../renderers/WebGLFishPropsAdapter.js';
import { fishPropsRenderRecords } from './fish-props-render-records.js';

const result = document.querySelector( '#result' );
let renderer, adapter;

try {
	const canvas = document.createElement( 'canvas' );
	canvas.width = 960;
	canvas.height = 600;
	renderer = new THREE.WebGLRenderer( { canvas, antialias: false, preserveDrawingBuffer: true } );
	renderer.setSize( canvas.width, canvas.height, false );
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.NoToneMapping;

	const scene = new THREE.Scene();
	// Match the WebGPU harness's rendered clear pixel so side-by-side captures
	// emphasize fish materials instead of a different canvas background.
	const background = 0x050c14;
	scene.background = new THREE.Color( background );
	const camera = new THREE.PerspectiveCamera( 34, canvas.width / canvas.height, 0.1, 80 );
	camera.position.set( 0, 4.1, 13.5 );
	camera.lookAt( 0, 0.15, - 0.8 );
	camera.updateProjectionMatrix();
	scene.add( new THREE.HemisphereLight( 0xdcecff, 0x584335, 2.2 ) );
	const key = new THREE.DirectionalLight( 0xffedcf, 3.1 );
	key.position.set( - 4, 7, 6 );
	scene.add( key );
	const fill = new THREE.DirectionalLight( 0x9dcaff, 1.4 );
	fill.position.set( 5, 3, - 5 );
	scene.add( fill );

	const records = fishPropsRenderRecords( fishPresentation );
	adapter = new WebGLFishPropsAdapter( THREE, scene, records, fishPresentation );
	renderer.render( scene, camera );

	const gl = renderer.getContext();
	const pixels = new Uint8Array( canvas.width * canvas.height * 4 );
	gl.readPixels( 0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels );
	const bgRGB = [ ( background >> 16 ) & 0xff, ( background >> 8 ) & 0xff, background & 0xff ];
	let changedPixels = 0;
	for ( let offset = 0; offset < pixels.length; offset += 4 ) {
		const delta = Math.abs( pixels[ offset ] - bgRGB[ 0 ] ) + Math.abs( pixels[ offset + 1 ] - bgRGB[ 1 ] ) + Math.abs( pixels[ offset + 2 ] - bgRGB[ 2 ] );
		if ( delta > 24 && pixels[ offset + 3 ] > 0 ) changedPixels ++;
	}
	const glErrors = [];
	for ( let error = gl.getError(); error !== gl.NO_ERROR; error = gl.getError() ) glErrors.push( `0x${ error.toString( 16 ) }` );
	const programs = renderer.info.programs || [];
	const failedPrograms = programs.filter( program => program.diagnostics?.runnable === false ).length;
	if ( changedPixels < 500 ) throw new Error( `fish props rendered too few non-background pixels (${ changedPixels })` );
	if ( ! programs.length || failedPrograms ) throw new Error( `WebGL program status failed (${ programs.length } program(s), ${ failedPrograms } failed)` );
	if ( glErrors.length ) throw new Error( `WebGL reported error(s): ${ glErrors.join( ', ' ) }` );
	result.textContent = JSON.stringify( {
		status: 'complete', changedPixels, programCount: programs.length, failedPrograms, glErrors,
		png: canvas.toDataURL( 'image/png' ),
	} );
	result.dataset.status = 'complete';
} catch ( error ) {
	result.textContent = `FAIL ${ error.stack || error }`;
	result.dataset.status = 'failed';
} finally {
	adapter?.dispose();
	renderer?.dispose();
}
