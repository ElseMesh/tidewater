import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import '../../../test/headless.mjs';
import { GPU, readBuffer, FrameUniforms, G, setFrameCamera } from '../../../src/engine/webgpu.js';
import { PerspectiveCamera } from '../../../src/engine/index.js';
import { HeightfieldTerrainData } from '../../../src/world/HeightfieldTerrainData.js';
import { TerrainGPU } from '../../../src/world/TerrainGPU.js';
import { decodeTerrainSurfaceAsset } from '../../../src/network/TerrainSurfaceAsset.js';
import { decodeBreakerStationsAsset, BREAKER_STATIONS_ASSET_KIND } from '../../../src/network/BreakerStationsAsset.js';
import { ShoreWaves } from '../../../src/ocean/ShoreWaves.js';
import { Breakers } from '../../../src/ocean/Breakers.js';
import { makeSky, makeClouds, makeFFT, makeSpray } from '../../../test/ocean-shore-stubs.mjs';
import { prepareWebGLBreakerTransects, updateWebGLBreakerCrestState } from '../../../src/fallback/WebGLBreakerLips.js';
import source from '../world-source.json' with { type: 'json' };

const worldRoot = fileURLToPath( new URL( '..', import.meta.url ) );
const readAsset = async assetId => new Uint8Array( await readFile( `${worldRoot}/assets/${assetId.slice( 'sha256:'.length )}` ) );
const terrainComponent = source.components.find( component => component.type === 'elsemesh.terrain-surface/1' );
const oceanComponent = source.components.find( component => component.type === 'elsemesh.island-ocean/1' );
const stationReference = oceanComponent?.assets?.find( reference => reference.kind === BREAKER_STATIONS_ASSET_KIND );
assert( terrainComponent?.data?.dataAssetId && stationReference?.assetId, 'Tidewater signs terrain and breaker-station source assets' );

const terrainPackage = await decodeTerrainSurfaceAsset( await readAsset( terrainComponent.data.dataAssetId ) );
const terrainData = new HeightfieldTerrainData( terrainPackage );
const stations = decodeBreakerStationsAsset( await readAsset( stationReference.assetId ) );
const stationRows = Array.from( { length: stations.count }, ( _, index ) => ( {
	center: [ stations.data[ index * 4 ], stations.data[ index * 4 + 1 ] ],
	direction: [ stations.data[ index * 4 + 2 ], stations.data[ index * 4 + 3 ] ],
	contour: 0,
} ) );
const transects = prepareWebGLBreakerTransects( stationRows, terrainData, terrainPackage.shoreField, 0 );
const webglState = new Float32Array( stations.count * 2 * 12 );

await GPU.init( { headless: true } );
const terrainGPU = new TerrainGPU( terrainData, terrainPackage.shoreField, terrainPackage );
const shore = new ShoreWaves( terrainGPU );
const surface = { fft: makeFFT(), terrain: terrainGPU, amplitude: { value: 1 } };
const breakers = new Breakers( null, { surface, shore, stations, sky: makeSky(), spray: makeSpray(), clouds: makeClouds() } );
const camera = new PerspectiveCamera( 50, 16 / 9, 0.1, 2000 );
camera.position.set( 15, 3, -58 );
camera.lookAt( 15, 0, 20 );

try {
	for ( const time of [ 1001.067, 1001.567, 1002.067 ] ) {
		G.time.value = time;
		G.dt.value = 1 / 60;
		FrameUniforms.fields.frameIndex.value ++;
		GPU.beginFrame();
		setFrameCamera( camera, 1600, 813 );
		breakers.update( camera );
		GPU.submit();
		await GPU.queue.onSubmittedWorkDone();
		const webgpuState = new Float32Array( await readBuffer( breakers.crest, stations.count * 6 * 16 ) );
		updateWebGLBreakerCrestState( stationRows, transects, 0, time, webglState );

		let activeSlots = 0, edgeSlots = 0;
		for ( let station = 0; station < stations.count; station ++ ) for ( let slot = 0; slot < 2; slot ++ ) {
			const gpuBase = ( station * 6 + slot * 3 ) * 4;
			const textureIndex = station * 2 + slot;
			const glBase = textureIndex * 4;
			const glBack = ( stations.count * 2 + textureIndex ) * 4;
			const glDirection = ( stations.count * 4 + textureIndex ) * 4;
			const gpuActive = webgpuState[ gpuBase + 11 ] > 0.5;
			const glActive = webglState[ glDirection + 3 ] > 0.5;
			if ( glActive !== gpuActive ) {
				const edgeB = gpuActive ? webgpuState[ gpuBase + 3 ] : webglState[ glBase + 3 ];
				assert.ok( Math.abs( edgeB + 0.6 ) < 0.01,
					`unmatched crest slots must be within the f32 precision band of the b=-0.6 visibility threshold (station ${station}, slot ${slot}, time ${time}, b=${edgeB})` );
				edgeSlots ++;
				continue;
			}
			if ( ! gpuActive ) continue;
			activeSlots ++;
			assert.equal( Math.round( webglState[ glDirection + 3 ] ), Math.round( webgpuState[ gpuBase + 11 ] ), 'both backends identify the same breaking wave' );
			for ( const [ gpuOffset, glOffset ] of [ [ gpuBase, glBase ], [ gpuBase + 4, glBack ], [ gpuBase + 8, glDirection ] ] ) {
				for ( let component = 0; component < 4; component ++ ) {
					assert.ok( Math.abs( webgpuState[ gpuOffset + component ] - webglState[ glOffset + component ] ) < 0.03,
						`Tidewater crest state matches within 3 cm at station ${station}, slot ${slot}, component ${component}, time ${time}` );
				}
			}
		}
		assert.ok( activeSlots > 0, `the signed Tidewater stations produce active breakers at ${time}` );
		console.log( `phase ${time}: ${activeSlots} active slots match; ${edgeSlots} are within the 0.01 b-threshold precision band` );
	}
	console.log( `Tidewater WebGPU/WebGL breaker crest state matches across three phases (${stations.count} signed stations)` );
} finally {
	breakers.dispose();
	terrainGPU.dispose();
}
