import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { parseGLB } from '../../../src/engine/loaders/GLTF.js';
import { applyWebGLWorldMaterialGraphs } from '../../../src/fallback/WebGLWorldMaterialGraphs.js';
import { G } from '../../../src/engine/render/Frame.js';
import source from '../world-source.json' with { type: 'json' };

const result = document.querySelector( '#result' );
let renderer;
try {
	const village = source.objects.find( object => object.id === 'elsemesh-object:island-village' );
	if ( ! village ) throw new Error( 'signed Tidewater package has no village object' );
	const glbBytes = await fetch( '/__tidewater/village.glb' ).then( response => {
		if ( ! response.ok ) throw new Error( `village GLB fetch failed: ${response.status}` );
		return response.arrayBuffer();
	} );
	const parsedGLB = parseGLB( glbBytes );
	const netMaterialIndex = parsedGLB.materials.findIndex( material => material.name === 'Procedural village net' );
	const netPrimitive = parsedGLB.meshes.flat().find( primitive => primitive.material === netMaterialIndex );
	if ( netMaterialIndex < 0 || ! netPrimitive?.attributes._ELSEMESH_VDATA ) throw new Error( 'signed net GLB is missing its VEC4 _ELSEMESH_VDATA' );
	const gltf = await new GLTFLoader().loadAsync( '/__tidewater/village.glb' );
	const netMeshes = [];
	gltf.scene.traverse( object => {
		if ( ! object.isMesh ) return;
		if ( object.material?.name === 'Procedural village net' ) {
			object.geometry.setAttribute( '_ELSEMESH_VDATA', new THREE.BufferAttribute( netPrimitive.attributes._ELSEMESH_VDATA.array, 4 ) );
			netMeshes.push( object );
		}
		else object.visible = false;
	} );
	if ( netMeshes.length !== 1 ) throw new Error( `expected one signed net material mesh, found ${netMeshes.length}` );
	const compiled = applyWebGLWorldMaterialGraphs( THREE, gltf.scene );
	if ( compiled !== 1 ) throw new Error( `expected one engine-compiled graph, found ${compiled}` );
	const netMesh = netMeshes[ 0 ];
	if ( ! netMesh.material.userData?.elsemeshWorldMaterialGraph ) throw new Error( 'net mesh did not pass through the engine graph compiler' );
	if ( netMesh.material.side !== THREE.DoubleSide || ! netMesh.material.transparent || netMesh.material.depthWrite ) throw new Error( 'net material lost its signed glTF blend or double-sided state' );

	const bounds = new THREE.Box3().setFromObject( netMesh );
	const center = bounds.getCenter( new THREE.Vector3() );
	const size = bounds.getSize( new THREE.Vector3() );
	const distance = Math.max( size.length() * 0.9, 0.8 );
	const scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x18232b );
	scene.add( new THREE.HemisphereLight( 0xc9e2ff, 0x40352a, 1.8 ) );
	const sun = new THREE.DirectionalLight( 0xffe4bd, 2.4 );
	sun.position.set( center.x + distance, center.y + distance * 0.5, center.z + distance );
	scene.add( sun, gltf.scene );
	const camera = new THREE.PerspectiveCamera( 45, 640 / 480, 0.05, Math.max( 100, distance * 5 ) );
	camera.position.set( center.x, center.y + size.y * 0.12, center.z + distance );
	camera.lookAt( center );
	G.time.value = 0.75;
	G.windDir.value.set( 0.8, 0.6 );
	G.windSpeed.value = 4.5;
	renderer = new THREE.WebGLRenderer( { antialias: false, alpha: false, preserveDrawingBuffer: true } );
	renderer.setPixelRatio( 1 );
	renderer.setSize( 640, 480, false );
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.NoToneMapping;
	document.body.append( renderer.domElement );
	renderer.render( scene, camera );
	const gl = renderer.getContext();
	const pixels = new Uint8Array( 640 * 480 * 4 );
	gl.readPixels( 0, 0, 640, 480, gl.RGBA, gl.UNSIGNED_BYTE, pixels );
	const background = [ 24, 35, 43 ];
	let changedPixels = 0;
	for ( let i = 0; i < pixels.length; i += 4 ) {
		if ( Math.abs( pixels[ i ] - background[ 0 ] ) + Math.abs( pixels[ i + 1 ] - background[ 1 ] ) + Math.abs( pixels[ i + 2 ] - background[ 2 ] ) > 16 ) changedPixels ++;
	}
	const glError = gl.getError();
	if ( changedPixels < 5 ) throw new Error( `signed net graph rendered too few visible pixels (${changedPixels})` );
	if ( glError !== gl.NO_ERROR ) throw new Error( `WebGL reported error ${glError}` );
	result.textContent = JSON.stringify( { changedPixels, programs: renderer.info.programs?.length || 0, glError, textureSlot: 'metallicRoughness' } );
	result.dataset.status = 'complete';
} catch ( error ) {
	result.textContent = error?.stack || String( error );
	result.dataset.status = 'failed';
} finally {
	renderer?.dispose();
}
