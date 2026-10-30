import * as THREE from 'three';
import { WebGLWaterQuery } from '../../../src/fallback/WebGLWaterQuery.js';
import { decodeTerrainSurfaceAsset } from '../../../src/network/TerrainSurfaceAsset.js';
import { HeightfieldTerrainData } from '../../../src/world/HeightfieldTerrainData.js';
import { createWebGLShoreSurfaceOffset } from '../webgl-shore-surface.js';

const result = document.querySelector( '#result' );
let renderer, query;
try {
	const referenceResponse = await fetch( './webgpu-shore-query-reference.json', { cache: 'no-store' } );
	if ( ! referenceResponse.ok ) throw new Error( 'Generate webgpu-shore-query-reference.json with the Tidewater WebGPU reference writer first' );
	const reference = await referenceResponse.json();
	if ( reference.protocol !== 'elsemesh.tidewater-shore-query-parity/1' ) throw new Error( 'Invalid Tidewater shoreline parity reference protocol' );
	const source = await fetch( '../world-source.json', { cache: 'no-store' } ).then( response => response.json() );
	const terrainComponent = source.components.find( component => component.type === 'elsemesh.terrain-surface/1' );
	const assetResponse = await fetch( `../assets/${terrainComponent.data.dataAssetId.slice( 'sha256:'.length )}`, { cache: 'no-store' } );
	if ( ! assetResponse.ok ) throw new Error( 'Could not load Tidewater packaged terrain surface' );
	const maps = await decodeTerrainSurfaceAsset( await assetResponse.arrayBuffer() );
	const terrain = new HeightfieldTerrainData( maps );
	if ( terrain.size !== reference.terrain.size || terrain.origin !== reference.terrain.origin || terrain.res !== reference.terrain.resolution ) throw new Error( 'WebGPU reference and WebGL terrain package differ' );
	renderer = new THREE.WebGLRenderer( { canvas: document.createElement( 'canvas' ), antialias: false } );
	query = new WebGLWaterQuery( THREE, renderer, terrain, reference.seaLevel );
	query.setSurfaceOffsetSampler( createWebGLShoreSurfaceOffset( { terrain, seaLevel: reference.seaLevel, field: maps.shoreField } ) );
	const start = query.allocate( 'shore-parity', reference.points.length );
	for ( let i = 0; i < reference.points.length; i ++ ) query.setPoint( start + i, ...reference.points[ i ] );
	const deadline = performance.now() + 20000;
	while ( ! query.cpuValid && performance.now() < deadline ) {
		query.update( 0, reference.time );
		await new Promise( resolve => setTimeout( resolve, 0 ) );
	}
	if ( ! query.cpuValid ) throw new Error( `WebGL shoreline query timed out${query.readbackError ? `: ${query.readbackError}` : ''}` );
	let heightError = 0, maxHeightError = 0, normalError = 0, floorError = 0;
	const samples = reference.points.map( ( point, i ) => {
		const actual = Array.from( query.cpu.slice( ( start + i ) * 4, ( start + i + 1 ) * 4 ) );
		const expected = reference.webgpu[ i ];
		const errors = actual.map( ( value, channel ) => Math.abs( value - expected[ channel ] ) );
		heightError += errors[ 0 ]; maxHeightError = Math.max( maxHeightError, errors[ 0 ] );
		normalError += errors[ 1 ] + errors[ 2 ]; floorError += errors[ 3 ];
		return { point, webgpu: expected, webgl: actual, errors };
	} );
	heightError /= samples.length;
	normalError /= samples.length * 2;
	floorError /= samples.length;
	result.textContent = JSON.stringify( { status: 'complete', count: samples.length, heightError, maxHeightError, normalError, floorError, samples } );
	result.dataset.status = 'complete';
} catch ( error ) {
	result.textContent = JSON.stringify( { status: 'failed', error: error.stack || String( error ) } );
	result.dataset.status = 'failed';
} finally {
	query?.dispose();
	renderer?.dispose();
}
