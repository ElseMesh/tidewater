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
	const graphMaterialIndexes = new Map( parsedGLB.materials.flatMap( ( material, index ) => material.name === 'Procedural village net' || material.extras?.elsemeshWorld?.materialRole === 'thatch' ? [ [ material.name, index ] ] : [] ) );
	if ( graphMaterialIndexes.size !== 2 ) throw new Error( 'signed village GLB is missing its net or thatch graph material' );
	const graphAttributes = new Map( [ ...graphMaterialIndexes ].map( ( [ name, index ] ) => {
		const primitive = parsedGLB.meshes.flat().find( candidate => candidate.material === index );
		if ( ! primitive?.attributes._ELSEMESH_VDATA ) throw new Error( `signed ${name} GLB mesh is missing its VEC4 _ELSEMESH_VDATA` );
		return [ name, primitive.attributes._ELSEMESH_VDATA ];
	} ) );
	const gltf = await new GLTFLoader().loadAsync( '/__tidewater/village.glb' );
	const graphMeshes = new Map( [ ...graphMaterialIndexes.keys() ].map( name => [ name, [] ] ) );
	gltf.scene.traverse( object => {
		if ( ! object.isMesh ) return;
		const name = object.material?.name;
		if ( ! graphMeshes.has( name ) ) { object.visible = false; return; }
		object.geometry.setAttribute( '_ELSEMESH_VDATA', new THREE.BufferAttribute( graphAttributes.get( name ).array, 4 ) );
		graphMeshes.get( name ).push( object );
	} );
	for ( const [ name, meshes ] of graphMeshes ) if ( meshes.length !== 1 ) throw new Error( `expected one signed ${name} material mesh, found ${meshes.length}` );
	const compiled = applyWebGLWorldMaterialGraphs( THREE, gltf.scene );
	if ( compiled !== 2 ) throw new Error( `expected two engine-compiled graphs, found ${compiled}` );
	const netMesh = graphMeshes.get( 'Procedural village net' )[ 0 ];
	const thatchMesh = graphMeshes.get( 'Procedural village thatch' )[ 0 ];
	for ( const mesh of [ netMesh, thatchMesh ] ) if ( ! mesh.material.userData?.elsemeshWorldMaterialGraph ) throw new Error( `${mesh.material.name} did not pass through the engine graph compiler` );
	if ( netMesh.material.side !== THREE.DoubleSide || ! netMesh.material.transparent || netMesh.material.depthWrite ) throw new Error( 'net material lost its signed glTF blend or double-sided state' );

	const scene = new THREE.Scene();
	const backgroundColor = new THREE.Color( 0x18232b );
	scene.background = backgroundColor;
	scene.add( new THREE.HemisphereLight( 0xc9e2ff, 0x40352a, 1.8 ) );
	const sun = new THREE.DirectionalLight( 0xffe4bd, 2.4 );
	sun.position.set( 10, 12, 10 );
	scene.add( sun, gltf.scene );
	const camera = new THREE.PerspectiveCamera( 45, 640 / 480, 0.05, 10000 );
	G.time.value = 0.75;
	G.windDir.value.set( 0.8, 0.6 );
	G.windSpeed.value = 4.5;
	renderer = new THREE.WebGLRenderer( { antialias: false, alpha: false, preserveDrawingBuffer: true } );
	renderer.setPixelRatio( 1 );
	renderer.setSize( 640, 480, false );
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.NoToneMapping;
	document.body.append( renderer.domElement );
	const gl = renderer.getContext();
	const pixels = new Uint8Array( 640 * 480 * 4 );
	const metrics = {};
	for ( const [ label, mesh ] of [ [ 'net', netMesh ], [ 'thatch', thatchMesh ] ] ) {
		for ( const target of graphMeshes.values() ) target[ 0 ].visible = target[ 0 ] === mesh;
		const bounds = new THREE.Box3().setFromObject( mesh );
		const center = bounds.getCenter( new THREE.Vector3() );
		const size = bounds.getSize( new THREE.Vector3() );
		const distance = Math.max( size.length() * 0.9, 0.8 );
		camera.position.set( center.x, center.y + size.y * 0.12, center.z + distance );
		camera.lookAt( center );
		renderer.render( scene, camera );
		gl.readPixels( 0, 0, 640, 480, gl.RGBA, gl.UNSIGNED_BYTE, pixels );
		let changedPixels = 0;
		for ( let i = 0; i < pixels.length; i += 4 ) {
			if ( Math.abs( pixels[ i ] - 24 ) + Math.abs( pixels[ i + 1 ] - 35 ) + Math.abs( pixels[ i + 2 ] - 43 ) > 16 ) changedPixels ++;
		}
		if ( changedPixels < 5 ) throw new Error( `signed ${label} graph rendered too few visible pixels (${changedPixels})` );
		metrics[ label ] = changedPixels;
	}
	const glError = gl.getError();
	if ( glError !== gl.NO_ERROR ) throw new Error( `WebGL reported error ${glError}` );
	result.textContent = JSON.stringify( { ...metrics, programs: renderer.info.programs?.length || 0, glError, textureSlots: [ 'metallicRoughness', 'normal', 'occlusion' ] } );
	result.dataset.status = 'complete';
} catch ( error ) {
	result.textContent = error?.stack || String( error );
	result.dataset.status = 'failed';
} finally {
	renderer?.dispose();
}
