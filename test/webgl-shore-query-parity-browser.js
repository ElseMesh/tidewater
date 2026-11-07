import * as THREE from 'three';
import { WebGLWaterQuery } from '../../../src/fallback/WebGLWaterQuery.js';
import { decodeTerrainSurfaceAsset } from '../../../src/network/TerrainSurfaceAsset.js';
import { HeightfieldTerrainData } from '../../../src/world/HeightfieldTerrainData.js';
import { BoatController } from '../../../src/player/BoatController.js';
import { BoatDesign } from '../../../src/world/boat/BoatDesign.js';
import { Vector3 } from '../../../src/engine/math/Vector3.js';
import { createWebGLShoreSurfaceOffset } from '../../../src/fallback/WebGLShoreSurface.js';
import { WebGLWakeSim } from '../../../src/ocean/WebGLWakeSim.js';

const result = document.querySelector( '#result' );
const WAKE_TRACE_SECONDS = 3;
let renderer, query, wakeQuery, wake;
try {
	const referenceResponse = await fetch( './webgpu-shore-query-reference.json', { cache: 'no-store' } );
	if ( ! referenceResponse.ok ) throw new Error( 'Generate webgpu-shore-query-reference.json with the Tidewater WebGPU reference writer first' );
	const reference = await referenceResponse.json();
	if ( reference.protocol !== 'elsemesh.tidewater-shore-query-parity/2' ) throw new Error( 'Invalid Tidewater shoreline parity reference protocol' );
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
	query.setSurfaceOffsetSampler( 'shore', createWebGLShoreSurfaceOffset( { terrain, seaLevel: reference.seaLevel, field: maps.shoreField } ) );
	let shoreOffsetError = 0, maxShoreOffsetError = 0, shorePointError = 0, maxShorePointError = 0;
	for ( let i = 0; i < reference.points.length; i ++ ) {
		const actual = query.sampleSurfaceOffset( ...reference.points[ i ], reference.time );
		const expected = reference.shoreOnly[ i ][ 0 ] - reference.seaLevel;
		const error = Math.abs( actual - expected );
		shoreOffsetError += error;
		maxShoreOffsetError = Math.max( maxShoreOffsetError, error );
		const pointError = Math.abs( actual - reference.shoreAtPoint[ i ][ 1 ] );
		shorePointError += pointError;
		maxShorePointError = Math.max( maxShorePointError, pointError );
	}
	shoreOffsetError /= reference.points.length;
	shorePointError /= reference.points.length;
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
	const tracePointSlot = query.allocate( 'boat-trace-point', 1 );
	boat.driven = true;
	boat.moored = false;
	const boatTrace = [];
	for ( let frame = 0; frame < 18 * 60; frame ++ ) {

		const dt = 1 / 60, time = ( frame + 1 ) * dt;
		boat.setInput( 1, frame < 12 * 60 ? 0 : - 0.7, dt );
		boat.queueQueries();
		query.setPoint( tracePointSlot, boat.position.x + boat.velocity.x * dt, boat.position.z + boat.velocity.z * dt );
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
			waterPoint: Array.from( query.resultInputs.slice( tracePointSlot * 4, tracePointSlot * 4 + 2 ) ),
			water: Array.from( query.cpu.slice( tracePointSlot * 4, tracePointSlot * 4 + 4 ) ),
		} );

	}
	if ( ! boat.isFinite() ) throw new Error( 'WebGL production-query boat trace became non-finite' );
	if ( boatTrace.length !== reference.boatTrace?.length || boatTrace.length !== 18 ) throw new Error( `WebGPU and WebGL production boat traces must each contain 18 one-second samples (WebGL ${boatTrace.length}, WebGPU ${reference.boatTrace?.length})` );
	let maxBoatPositionDelta = 0, maxBoatSpeedDelta = 0;
	const boatSamples = boatTrace.map( ( actual, i ) => {
		const expected = reference.boatTrace[ i ];
		const positionDelta = Math.hypot( ...actual.position.map( ( value, axis ) => value - expected.position[ axis ] ) );
		const speedDelta = Math.abs( actual.speed - expected.speed );
		maxBoatPositionDelta = Math.max( maxBoatPositionDelta, positionDelta );
		maxBoatSpeedDelta = Math.max( maxBoatSpeedDelta, speedDelta );
		return { second: i + 1, positionDelta, speedDelta, webgpu: expected, webgl: actual };
	} );
	const traceProbeSlot = query.allocate( 'webgpu-boat-trace-probe', 1 );
	let traceWaterHeightError = 0, maxTraceWaterHeightError = 0, traceWaterNormalError = 0;
	const traceWaterSamples = [];
	for ( let i = 0; i < reference.boatTrace.length; i ++ ) {

		const expected = reference.boatTrace[ i ];
		while ( query._pending ) await new Promise( resolve => setTimeout( resolve, 1 ) );
		query.setPoint( traceProbeSlot, ...expected.waterPoint );
		const previousVersion = query.version;
		const time = i + 1, dt = 1 / 60;
		query.update( dt, time );
		const probeDeadline = performance.now() + 5000;
		while ( query.version === previousVersion && performance.now() < probeDeadline ) await new Promise( resolve => setTimeout( resolve, 1 ) );
		if ( query.version === previousVersion ) throw new Error( `WebGL fixed-position water probe timed out at ${time} s` );
		while ( query._pending ) await new Promise( resolve => setTimeout( resolve, 1 ) );
		const actual = Array.from( query.cpu.slice( traceProbeSlot * 4, traceProbeSlot * 4 + 4 ) );
		const heightDelta = Math.abs( actual[ 0 ] - expected.water[ 0 ] );
		const normalDelta = Math.hypot( actual[ 1 ] - expected.water[ 1 ], actual[ 2 ] - expected.water[ 2 ] );
		traceWaterHeightError += heightDelta;
		maxTraceWaterHeightError = Math.max( maxTraceWaterHeightError, heightDelta );
		traceWaterNormalError += normalDelta;
		traceWaterSamples.push( { second: time, point: expected.waterPoint, depth: reference.seaLevel - expected.water[ 3 ], webgpu: expected.water, webgl: actual, heightDelta, normalDelta } );

	}
	traceWaterHeightError /= reference.boatTrace.length;
	traceWaterNormalError /= reference.boatTrace.length * 2;
	const surfaceOffsetSampler = query.getSurfaceOffsetSampler( 'shore' );
	let fftOnlyHeightError = 0, maxFFTOnlyHeightError = 0, fftOnlyNormalError = 0;
	const fftOnlySamples = [];
	try {
		query.setSurfaceOffsetSampler( 'shore', null );
		for ( let i = 0; i < reference.boatTrace.length; i ++ ) {
			const expected = reference.boatTrace[ i ], time = i + 1;
			query.setPoint( traceProbeSlot, ...expected.waterPoint );
			const previousVersion = query.version;
			query.update( 0, time );
			const deadline = performance.now() + 5000;
			while ( query.version === previousVersion && performance.now() < deadline ) await new Promise( resolve => setTimeout( resolve, 1 ) );
			if ( query.version === previousVersion ) throw new Error( `WebGL FFT-only water probe timed out at ${time} s` );
			while ( query._pending ) await new Promise( resolve => setTimeout( resolve, 1 ) );
			const actual = Array.from( query.cpu.slice( traceProbeSlot * 4, traceProbeSlot * 4 + 4 ) );
			const expectedFFT = expected.waterFFTOnly;
			if ( ! Array.isArray( expectedFFT ) || expectedFFT.length !== 4 ) throw new Error( `Missing WebGPU FFT-only sample at ${time} s` );
			const heightDelta = Math.abs( actual[ 0 ] - expectedFFT[ 0 ] );
			const normalDelta = Math.hypot( actual[ 1 ] - expectedFFT[ 1 ], actual[ 2 ] - expectedFFT[ 2 ] );
			fftOnlyHeightError += heightDelta;
			maxFFTOnlyHeightError = Math.max( maxFFTOnlyHeightError, heightDelta );
			fftOnlyNormalError += normalDelta;
			fftOnlySamples.push( { second: time, point: expected.waterPoint, webgpu: expectedFFT, webgl: actual, heightDelta, normalDelta } );
		}
	} finally {
		query.setSurfaceOffsetSampler( 'shore', surfaceOffsetSampler );
	}
	fftOnlyHeightError /= reference.boatTrace.length;
	fftOnlyNormalError /= reference.boatTrace.length * 2;
	const wakeQueryInstance = wakeQuery = new WebGLWaterQuery( THREE, renderer, terrain, reference.seaLevel );
	const wakeBoat = new BoatController( {
		design: new BoatDesign(), query: wakeQueryInstance, terrain,
		colliders: { resolveCapsule: () => false }, initialPosition: new Vector3( ...berthObject.transform.position ), initialHeading: berthObject.transform.yaw,
	} );
	wakeBoat.driven = true;
	wakeBoat.moored = false;
	wakeQueryInstance.setSurfaceOffsetSampler( 'shore', createWebGLShoreSurfaceOffset( { terrain, seaLevel: reference.seaLevel, field: maps.shoreField } ) );
	wake = new WebGLWakeSim( THREE, renderer, { terrain, boat: wakeBoat, colliders: { cylinders: [] }, seaLevel: reference.seaLevel } );
	wakeQueryInstance.setWakeReader( wake.readerUniforms );
	wakeQueryInstance.latency = 1 / 60;
	const wakeBoatSlot = wakeQueryInstance.allocate( 'wake-enabled-boat-point', 1 );
	const wakeProbeSlot = wakeQueryInstance.allocate( 'wake-enabled-reference-point', 1 );
	const wakeBoatTrace = [];
	for ( let frame = 0; frame < WAKE_TRACE_SECONDS * 60; frame ++ ) {

		const dt = 1 / 60, time = ( frame + 1 ) * dt;
		wakeBoat.setInput( 1, frame < 12 * 60 ? 0 : - 0.7, dt );
		wakeBoat.update( dt );
		wakeBoat.queueQueries();
		wakeQueryInstance.setPoint( wakeBoatSlot, wakeBoat.position.x + wakeBoat.velocity.x * dt, wakeBoat.position.z + wakeBoat.velocity.z * dt );
		if ( frame % 60 === 59 ) wakeQueryInstance.setPoint( wakeProbeSlot, ...reference.wakeBoatTrace[ Math.floor( frame / 60 ) ].waterPoint );
		while ( wakeQueryInstance._pending ) await new Promise( resolve => setTimeout( resolve, 1 ) );
		const previousVersion = wakeQueryInstance.version;
		wake.update( dt, time );
		wakeQueryInstance.update( dt, time );
		const wakeQueryDeadline = performance.now() + 5000;
		while ( wakeQueryInstance.version === previousVersion && performance.now() < wakeQueryDeadline ) await new Promise( resolve => setTimeout( resolve, 1 ) );
		if ( wakeQueryInstance.version === previousVersion ) throw new Error( `WebGL wake-enabled boat query timed out at frame ${frame}` );
		while ( wakeQueryInstance._pending ) await new Promise( resolve => setTimeout( resolve, 1 ) );
		wakeQueryInstance.latency = dt;
		if ( frame % 60 === 59 ) wakeBoatTrace.push( {
			position: [ wakeBoat.position.x, wakeBoat.position.y, wakeBoat.position.z ],
			velocity: [ wakeBoat.velocity.x, wakeBoat.velocity.y, wakeBoat.velocity.z ],
			quaternion: [ wakeBoat.quaternion.x, wakeBoat.quaternion.y, wakeBoat.quaternion.z, wakeBoat.quaternion.w ],
			speed: wakeBoat.speed,
			waterPoint: Array.from( wakeQueryInstance.resultInputs.slice( wakeBoatSlot * 4, wakeBoatSlot * 4 + 2 ) ),
			water: Array.from( wakeQueryInstance.cpu.slice( wakeBoatSlot * 4, wakeBoatSlot * 4 + 4 ) ),
			referenceWater: Array.from( wakeQueryInstance.cpu.slice( wakeProbeSlot * 4, wakeProbeSlot * 4 + 4 ) ),
			wakeAmount: wake.uniforms.uAmount.value,
			wakeSteps: wake.stepCount,
		} );

	}
	if ( ! wakeBoat.isFinite() || wakeBoatTrace.length !== reference.wakeBoatTrace.length || wake.stepCount < WAKE_TRACE_SECONDS * 60 - 1 || wake.stepCount > WAKE_TRACE_SECONDS * 60 ) throw new Error( `WebGL wake-enabled production boat trace did not complete all frames (${JSON.stringify( { boatFinite: wakeBoat.isFinite(), actualSamples: wakeBoatTrace.length, expectedSamples: reference.wakeBoatTrace.length, wakeSteps: wake.stepCount, expectedWakeSteps: [ WAKE_TRACE_SECONDS * 60 - 1, WAKE_TRACE_SECONDS * 60 ] } )})` );
	let maxWakeBoatPositionDelta = 0, maxWakeBoatSpeedDelta = 0, maxWakeWaterHeightDelta = 0, maxWakeWaterNormalDelta = 0, maxWakeStepDelta = 0;
	const wakeBoatSamples = wakeBoatTrace.map( ( actual, i ) => {
		const expected = reference.wakeBoatTrace[ i ];
		const positionDelta = Math.hypot( ...actual.position.map( ( value, axis ) => value - expected.position[ axis ] ) );
		const speedDelta = Math.abs( actual.speed - expected.speed );
		const heightDelta = Math.abs( actual.referenceWater[ 0 ] - expected.water[ 0 ] );
		const normalDelta = Math.hypot( actual.referenceWater[ 1 ] - expected.water[ 1 ], actual.referenceWater[ 2 ] - expected.water[ 2 ] );
		const stepDelta = Math.abs( actual.wakeSteps - expected.wakeSteps );
		maxWakeBoatPositionDelta = Math.max( maxWakeBoatPositionDelta, positionDelta );
		maxWakeBoatSpeedDelta = Math.max( maxWakeBoatSpeedDelta, speedDelta );
		maxWakeWaterHeightDelta = Math.max( maxWakeWaterHeightDelta, heightDelta );
		maxWakeWaterNormalDelta = Math.max( maxWakeWaterNormalDelta, normalDelta );
		maxWakeStepDelta = Math.max( maxWakeStepDelta, stepDelta );
		return { second: i + 1, positionDelta, speedDelta, heightDelta, normalDelta, stepDelta, webgpu: expected, webgl: actual };
	} );
	if ( ! wakeBoatSamples.every( sample => [ sample.positionDelta, sample.speedDelta, sample.heightDelta, sample.normalDelta ].every( Number.isFinite ) ) ) throw new Error( 'WebGL wake-enabled boat or water trace contains non-finite values' );
	result.textContent = JSON.stringify( { status: 'complete', count: samples.length, heightError, maxHeightError, normalError, floorError, samples, shoreProfile: { shoreOffsetError, maxShoreOffsetError, shorePointError, maxShorePointError }, boat: { maxPositionDelta: maxBoatPositionDelta, maxSpeedDelta: maxBoatSpeedDelta, traceWaterHeightError, maxTraceWaterHeightError, traceWaterNormalError, fftOnlyHeightError, maxFFTOnlyHeightError, fftOnlyNormalError, samples: boatSamples, traceWaterSamples, fftOnlySamples }, wakeBoat: { maxPositionDelta: maxWakeBoatPositionDelta, maxSpeedDelta: maxWakeBoatSpeedDelta, maxWaterHeightDelta: maxWakeWaterHeightDelta, maxWaterNormalDelta: maxWakeWaterNormalDelta, maxWakeStepDelta, samples: wakeBoatSamples } } );
	result.dataset.status = 'complete';
} catch ( error ) {
	result.textContent = JSON.stringify( { status: 'failed', error: error.stack || String( error ) } );
	result.dataset.status = 'failed';
} finally {
	wake?.dispose();
	wakeQuery?.dispose();
	query?.dispose();
	renderer?.dispose();
}
