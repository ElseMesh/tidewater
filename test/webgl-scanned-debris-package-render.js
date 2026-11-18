import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { defaultWorldPackage } from '../../default.js';
import { WebGLFallback } from '../../../src/fallback/WebGLFallback.js';
import '../../../src/fallback/WebGLComponentSupport.js';

const result = document.querySelector( '#result' );
const canvas = document.createElement( 'canvas' );
canvas.width = 192; canvas.height = 144;
canvas.hidden = true;
document.body.append( canvas );
const renderer = new THREE.WebGLRenderer( { canvas, antialias: false, preserveDrawingBuffer: true } );
renderer.setSize( canvas.width, canvas.height, false );
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
let runtime;

try {
	const component = defaultWorldPackage.source.components.find( entry => entry.id === 'elsemesh-component:scanned-debris' );
	if ( ! component ) throw new Error( 'The built-in world package has no signed scanned-debris component' );
	const scene = new THREE.Scene();
	scene.background = new THREE.Color( 0xaabccf );
	const sun = new THREE.DirectionalLight( new THREE.Color().setRGB( 3.2, 3.0, 2.7, THREE.LinearSRGBColorSpace ), 1 );
	sun.position.set( 0.45, 0.62, 0.35 );
	const sky = new THREE.AmbientLight( new THREE.Color().setRGB( 0.22, 0.3, 0.42, THREE.LinearSRGBColorSpace ), 1 );
	scene.add( sun, sky );
	const camera = new THREE.PerspectiveCamera( 55, canvas.width / canvas.height, 0.1, 1000 );
	const fallback = Object.assign( Object.create( WebGLFallback.prototype ), {
		defaultWorldSource: { ...defaultWorldPackage.source, components: [ component ] },
		defaultWorldAssets: defaultWorldPackage.assets,
		worldLink: null,
		THREE,
		scene,
		camera,
		renderer,
		loader: new GLTFLoader(),
		terrain: { origin: - 1024, size: 2048, res: 2, heights: new Float32Array( 4 ) },
		app: { renderLoadBias: 0 },
		builtinComponentRuntimes: new Map(),
	} );
	await fallback._loadBuiltinComponents();
	runtime = fallback.builtinComponentRuntimes.get( component.id );
	if ( ! runtime ) throw new Error( 'Built-in WebGL did not install the signed scanned-debris component' );
	const placementCount = runtime.document.instances.length;
	if ( placementCount !== 141 ) throw new Error( `Expected 141 authored scanned-debris placements, got ${placementCount}` );
	const beachTrunk = runtime.document.instances
		.filter( instance => instance.model === 'dead_quiver_trunk' && Math.hypot( instance.position[ 0 ] - 18, instance.position[ 2 ] + 52 ) < 40 )
		.sort( ( a, b ) => Math.max( ...b.scale ) - Math.max( ...a.scale ) )[ 0 ];
	if ( ! beachTrunk ) throw new Error( 'The signed Tidewater package has no authored trunk near the beach' );
	const trunkIndex = runtime.document.instances.indexOf( beachTrunk );
	const modelIndex = runtime.document.models.findIndex( model => model.id === beachTrunk.model );
	const batchStart = runtime.document.models.slice( 0, modelIndex ).reduce( ( count, model ) => count + model.lods.length, 0 );
	const lodGroups = runtime.planner._groupsByModel[ modelIndex ];
	const [ x, y, z ] = beachTrunk.position;
	camera.position.set( x + 6, y + 1.7, z + 4.5 );
	camera.lookAt( x, y, z );
	camera.updateProjectionMatrix();
	camera.updateMatrixWorld( true );
	const deadline = Date.now() + 30000;
	let visibleMeshes = [];
	while ( Date.now() < deadline ) {
		runtime.update( 1 / 60, camera, null, 0 );
		const desiredLOD = runtime.desiredLods[ modelIndex ];
		const desiredLoaded = desiredLOD >= 0 && runtime.loadedLods[ modelIndex ].has( desiredLOD );
		visibleMeshes = desiredLoaded
			? runtime.batches.slice( batchStart + desiredLOD, batchStart + desiredLOD + 1 )
				.flatMap( group => group.filter( batch => batch.mesh.count > 0 && batch.mesh.material.colorWrite && ! batch.mesh.userData.shadowOnly ).map( batch => batch.mesh ) )
			: [];
		if ( visibleMeshes.length > 0 ) break;
		await new Promise( resolve => setTimeout( resolve, 25 ) );
	}
	if ( visibleMeshes.length === 0 ) throw new Error( 'The authored beach trunk did not enter a built-in WebGL color LOD' );
	const connector = fallback.builtinAssetConnector;
	const textureAssets = [ ...connector.assets.keys() ].filter( id => connector.manifest.assets.some( asset => asset.id === id && asset.kind === 'image/jpeg' ) );
	if ( textureAssets.length === 0 ) throw new Error( 'Built-in WebGL did not fetch signed scanned-debris JPEG assets' );
	renderer.render( scene, camera );
	const pixels = new Uint8Array( canvas.width * canvas.height * 4 );
	const gl = renderer.getContext();
	gl.readPixels( 0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels );
	const background = pixels.subarray( 0, 3 );
	let changedPixels = 0;
	for ( let offset = 0; offset < pixels.length; offset += 4 ) if ( Math.abs( pixels[ offset ] - background[ 0 ] ) + Math.abs( pixels[ offset + 1 ] - background[ 1 ] ) + Math.abs( pixels[ offset + 2 ] - background[ 2 ] ) > 24 ) changedPixels ++;
	if ( changedPixels < 30 ) throw new Error( `The signed Tidewater beach trunk rendered too few pixels: ${changedPixels}` );
	const glError = gl.getError(), programs = renderer.info.programs || [];
	if ( glError !== gl.NO_ERROR ) throw new Error( `Built-in Tidewater debris render reported WebGL error 0x${glError.toString( 16 )}` );
	if ( programs.some( program => program.diagnostics?.runnable === false ) ) throw new Error( 'Built-in Tidewater debris compiled an invalid WebGL program' );
	const selectedLOD = lodGroups.findIndex( group => group.indices.subarray( 0, group.count ).includes( trunkIndex ) );
	if ( selectedLOD !== runtime.desiredLods[ modelIndex ] ) throw new Error( `Built-in WebGL rendered fallback LOD ${selectedLOD}; expected camera-selected LOD ${runtime.desiredLods[ modelIndex ]}` );
	if ( selectedLOD !== 0 ) throw new Error( `Close beach-trunk view selected LOD${selectedLOD}; expected LOD0, the highest-detail model` );
	const selectedAsset = runtime.document.models[ modelIndex ].lods[ selectedLOD ].assetId;
	if ( ! connector.assets.has( selectedAsset ) ) throw new Error( `Built-in WebGL did not load the selected signed LOD ${selectedAsset}` );
	result.textContent = JSON.stringify( { status: 'complete', placements: placementCount, visibleMeshes: visibleMeshes.length, textureAssets: textureAssets.length, changedPixels, programCount: programs.length, selectedLOD, selectedAsset, glError } );
	result.dataset.status = 'complete';
} catch ( error ) {
	result.textContent = `FAIL ${ error.stack || error }`;
	result.dataset.status = 'failed';
} finally {
	runtime?.dispose();
	renderer.dispose();
}
