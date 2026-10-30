import * as THREE from 'three';
import { WebGLWaterQuery } from '../../../src/fallback/WebGLWaterQuery.js';
import { decodeTerrainSurfaceAsset } from '../../../src/network/TerrainSurfaceAsset.js';
import { HeightfieldTerrainData } from '../../../src/world/HeightfieldTerrainData.js';
import { BoatController } from '../../../src/player/BoatController.js';
import { BoatDesign } from '../../../src/world/boat/BoatDesign.js';
import { Vector3 } from '../../../src/engine/math/Vector3.js';
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
	// Use a synchronous pixel transfer in this isolated correctness harness. The
	// headless Chromium async readback resolves the first query but leaves later
	// readbacks pending; this keeps query values testable without claiming to
	// measure the production async-readback path or its frame cost.
	const readRenderTargetPixels = renderer.readRenderTargetPixels.bind( renderer );
	renderer.readRenderTargetPixelsAsync = ( target, x, y, width, height, buffer ) => {
		readRenderTargetPixels( target, x, y, width, height, buffer );
		return Promise.resolve( buffer );
	};
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
	const berthObject = source.objects.find( object => object.id === 'elsemesh-object:moored-lobster-boat' );
	if ( ! Array.isArray( berthObject?.transform?.position ) || ! Number.isFinite( berthObject?.transform?.yaw ) ) throw new Error( 'Tidewater package has no authored boat berth and heading' );
	query.latency = 1 / 60;
	const design = new BoatDesign();
	const boat = new BoatController( {
		design, query, terrain, colliders: { resolveCapsule: () => false },
		initialPosition: new Vector3( ...berthObject.transform.position ), initialHeading: berthObject.transform.yaw,
	} );
	boat.driven = true;
	boat.moored = false;
	const boatTrace = [];
	for ( let frame = 0; frame < 18 * 60; frame ++ ) {

		const dt = 1 / 60, time = ( frame + 1 ) * dt;
		boat.setInput( 1, frame < 12 * 60 ? 0 : - 0.7, dt );
		boat.queueQueries();
		while ( query._pending ) await new Promise( resolve => setTimeout( resolve, 1 ) );
		const previousVersion = query.version;
		query.update( dt, time );
		const queryDeadline = performance.now() + 5000;
		while ( query.version === previousVersion && performance.now() < queryDeadline ) await new Promise( resolve => setTimeout( resolve, 1 ) );
		if ( query.version === previousVersion ) throw new Error( `WebGL boat water query timed out at frame ${frame}: ${JSON.stringify( { previousVersion, version: query.version, pending: query._pending, count: query.count, contextLost: renderer.getContext().isContextLost(), glError: renderer.getContext().getError(), readbackError: query.readbackError?.message || query.readbackError || null } )}` );
		while ( query._pending ) await new Promise( resolve => setTimeout( resolve, 1 ) );
		query.latency = dt;
		boat.update( dt );
		if ( frame % 60 === 59 ) boatTrace.push( {
			position: [ boat.position.x, boat.position.y, boat.position.z ],
			velocity: [ boat.velocity.x, boat.velocity.y, boat.velocity.z ],
			quaternion: [ boat.quaternion.x, boat.quaternion.y, boat.quaternion.z, boat.quaternion.w ],
			speed: boat.speed,
		} );

	}
	if ( ! boat.isFinite() ) throw new Error( 'WebGL production-query boat trace became non-finite' );
	if ( boatTrace.length !== reference.boatTrace?.length || boatTrace.length !== 18 ) throw new Error( 'WebGPU and WebGL production boat traces must each contain 18 one-second samples' );
	let maxBoatPositionDelta = 0, maxBoatSpeedDelta = 0;
	const boatSamples = boatTrace.map( ( actual, i ) => {
		const expected = reference.boatTrace[ i ];
		const positionDelta = Math.hypot( ...actual.position.map( ( value, axis ) => value - expected.position[ axis ] ) );
		const speedDelta = Math.abs( actual.speed - expected.speed );
		maxBoatPositionDelta = Math.max( maxBoatPositionDelta, positionDelta );
		maxBoatSpeedDelta = Math.max( maxBoatSpeedDelta, speedDelta );
		return { second: i + 1, positionDelta, speedDelta, webgpu: expected, webgl: actual };
	} );
	result.textContent = JSON.stringify( { status: 'complete', count: samples.length, heightError, maxHeightError, normalError, floorError, samples, boat: { maxPositionDelta: maxBoatPositionDelta, maxSpeedDelta: maxBoatSpeedDelta, samples: boatSamples } } );
	result.dataset.status = 'complete';
} catch ( error ) {
	result.textContent = JSON.stringify( { status: 'failed', error: error.stack || String( error ) } );
	result.dataset.status = 'failed';
} finally {
	query?.dispose();
	renderer?.dispose();
}
