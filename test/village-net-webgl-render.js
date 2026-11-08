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
	const graphMaterialIndexes = new Map( parsedGLB.materials.flatMap( ( material, index ) => material.name === 'Procedural village net' || [ 'hard', 'thatch', 'fabric', 'stone', 'roofMetal' ].includes( material.extras?.elsemeshWorld?.materialRole ) ? [ [ material.name, index ] ] : [] ) );
	if ( graphMaterialIndexes.size !== 8 ) throw new Error( `signed village GLB must contain eight graph material batches, found ${graphMaterialIndexes.size}` );
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
	for ( const [ name, meshes ] of graphMeshes ) {
		if ( name === 'Procedural village fabric' ? meshes.length < 1 : meshes.length !== 1 ) throw new Error( `unexpected signed ${name} material mesh count: ${meshes.length}` );
	}
	const compiled = applyWebGLWorldMaterialGraphs( THREE, gltf.scene );
	if ( compiled !== graphMaterialIndexes.size ) throw new Error( `expected ${graphMaterialIndexes.size} engine-compiled graphs, found ${compiled}` );
	const netMesh = graphMeshes.get( 'Procedural village net' )[ 0 ];
	const thatchMesh = graphMeshes.get( 'Procedural village thatch' )[ 0 ];
	const fabricMesh = graphMeshes.get( 'Procedural village fabric' )[ 0 ];
	const stoneMesh = graphMeshes.get( 'Procedural village stone' )[ 0 ];
	const roofMetalMesh = graphMeshes.get( 'Procedural village roofMetal' )[ 0 ];
	const hardMesh = graphMeshes.get( 'Procedural village hard' )[ 0 ];
	for ( const mesh of [ netMesh, thatchMesh, fabricMesh, stoneMesh, roofMetalMesh, hardMesh ] ) if ( ! mesh.material.userData?.elsemeshWorldMaterialGraph ) throw new Error( `${mesh.material.name} did not pass through the engine graph compiler` );
	if ( netMesh.material.side !== THREE.DoubleSide || ! netMesh.material.transparent || netMesh.material.depthWrite ) throw new Error( 'net material lost its signed glTF blend or double-sided state' );
	const focusGeometryCluster = mesh => {
		const geometry = mesh.geometry, index = geometry.index?.array, positions = geometry.getAttribute( 'position' )?.array, data = geometry.getAttribute( 'vdata' )?.array;
		if ( ! index || ! positions || ! data ) throw new Error( 'fabric render fixture requires indexed geometry, positions, and material data' );
		const cellSize = 4, cellFor = triangle => {
			if ( data[ index[ triangle ] * 4 + 2 ] <= 5000 ) return null;
			const center = [ 0, 1, 2 ].map( axis => ( positions[ index[ triangle ] * 3 + axis ] + positions[ index[ triangle + 1 ] * 3 + axis ] + positions[ index[ triangle + 2 ] * 3 + axis ] ) / 3 );
			return { key: center.map( value => Math.floor( value / cellSize ) ).join( ',' ) };
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
	focusGeometryCluster( fabricMesh );

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
	for ( const [ label, mesh ] of [ [ 'net', netMesh ], [ 'thatch', thatchMesh ], [ 'fabric', fabricMesh ], [ 'stone', stoneMesh ], [ 'roofMetal', roofMetalMesh ], [ 'hard', hardMesh ] ] ) {
		for ( const target of graphMeshes.values() ) target[ 0 ].visible = target[ 0 ] === mesh;
		const bounds = new THREE.Box3().setFromObject( mesh );
		const center = bounds.getCenter( new THREE.Vector3() );
		const size = bounds.getSize( new THREE.Vector3() );
		const distance = label === 'fabric' ? Math.max( size.length() * 1.3, 0.2 ) : Math.max( size.length() * 0.9, 0.8 );
		if ( label === 'fabric' || label === 'roofMetal' ) {
			const normals = mesh.geometry.getAttribute( 'normal' ).array;
			const direction = new THREE.Vector3();
			for ( let i = 0; i < normals.length; i += 3 ) direction.add( new THREE.Vector3( normals[ i ], normals[ i + 1 ], normals[ i + 2 ] ) );
			direction.normalize().applyQuaternion( mesh.getWorldQuaternion( new THREE.Quaternion() ) );
			camera.position.copy( center ).addScaledVector( direction, distance );
		} else camera.position.set( center.x, center.y + size.y * 0.12, center.z + distance );
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
