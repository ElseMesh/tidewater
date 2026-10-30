import '../../../test/headless.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { GPU, G } from '../../../src/engine/webgpu.js';
import { OceanFFT } from '../../../src/ocean/OceanFFT.js';
import { ShoreWaves } from '../../../src/ocean/ShoreWaves.js';
import { WaterQuery } from '../../../src/ocean/WaterQuery.js';
import { WaterSurface } from '../../../src/ocean/WaterSurface.js';
import { decodeTerrainSurfaceAsset } from '../../../src/network/TerrainSurfaceAsset.js';
import { HeightfieldTerrainData } from '../../../src/world/HeightfieldTerrainData.js';
import { TerrainGPU } from '../../../src/world/TerrainGPU.js';

const output = process.env.ELSEMESH_SHORE_QUERY_REFERENCE;
if ( ! output ) throw new Error( 'Set ELSEMESH_SHORE_QUERY_REFERENCE to an external build-tree JSON path' );
const source = JSON.parse( await readFile( new URL( '../world-source.json', import.meta.url ), 'utf8' ) );
const terrainComponent = source.components.find( component => component.type === 'elsemesh.terrain-surface/1' );
assert( terrainComponent, 'Tidewater package contains its authored terrain surface' );
const compressed = await readFile( new URL( `../assets/${terrainComponent.data.dataAssetId.slice( 'sha256:'.length )}`, import.meta.url ) );
const maps = await decodeTerrainSurfaceAsset( new Uint8Array( compressed ) );
const terrain = new HeightfieldTerrainData( maps );
await GPU.init( { headless: true } );
const terrainGPU = new TerrainGPU( terrain, maps.shoreField, {
	normal: maps.normal, splat: maps.splat, detailWidth: maps.detailWidth,
	detailHeight: maps.detailHeight, detail: maps.detail,
} );
const fft = new OceanFFT( null );
const surface = new WaterSurface( { fft, cdlod: {} } );
surface.terrain = terrainGPU;
surface.shore = new ShoreWaves( terrainGPU );
const query = new WaterQuery( null, surface );

const berth = source.objects.find( object => object.id === 'elsemesh-object:moored-lobster-boat' )?.transform.position;
assert( Array.isArray( berth ) && berth.length === 3, 'Tidewater package has its authored boat berth' );
const points = [
	[ berth[ 0 ], berth[ 2 ] ], [ berth[ 0 ] + 4, berth[ 2 ] ], [ berth[ 0 ] - 4, berth[ 2 ] ],
	[ berth[ 0 ], berth[ 2 ] + 8 ], [ berth[ 0 ], berth[ 2 ] - 8 ],
];
const coast = [];
const step = terrain.size / 40;
for ( let z = terrain.origin + step; z < terrain.origin + terrain.size; z += step ) {
	for ( let x = terrain.origin + step; x < terrain.origin + terrain.size; x += step ) {
		const depth = source.rules.seaLevel - terrain.heightAt( x, z );
		if ( depth <= 0.5 || depth >= 24 ) continue;
		const uv = [ ( x - maps.shoreField.origin ) / maps.shoreField.size, ( z - maps.shoreField.origin ) / maps.shoreField.size ];
		const i = Math.round( uv[ 1 ] * ( maps.shoreField.res - 1 ) ) * maps.shoreField.res + Math.round( uv[ 0 ] * ( maps.shoreField.res - 1 ) );
		const offset = i * 4;
		const exposure = Math.hypot( maps.shoreField.data[ offset + 1 ], maps.shoreField.data[ offset + 2 ] );
		if ( exposure > 0.1 ) coast.push( { x, z, exposure, depth } );
	}
}
coast.sort( ( a, b ) => b.exposure - a.exposure );
for ( const candidate of coast ) {
	if ( points.length >= 13 ) break;
	if ( points.every( point => Math.hypot( point[ 0 ] - candidate.x, point[ 1 ] - candidate.z ) > 80 ) ) points.push( [ candidate.x, candidate.z ] );
}
assert( points.length >= 10, `reference includes dock and exposed shallow-water points (${points.length})` );

try {
	const time = 4.25, start = query.allocate( 'parity', points.length );
	for ( let i = 0; i < points.length; i ++ ) query.setPoint( start + i, ...points[ i ] );
	GPU.beginFrame();
	G.time.value = time;
	G.dt.value = 1 / 60;
	fft.update( time );
	query.update();
	GPU.submit();
	await GPU.queue.onSubmittedWorkDone();
	const deadline = Date.now() + 15000;
	while ( ! query.cpuValid && Date.now() < deadline ) await new Promise( resolve => setTimeout( resolve, 0 ) );
	assert( query.cpuValid, 'pre-split WebGPU query returns production terrain and shoreline samples' );
	const reference = {
		protocol: 'elsemesh.tidewater-shore-query-parity/1', time, seaLevel: source.rules.seaLevel,
		terrain: { size: maps.size, origin: maps.origin, resolution: maps.resolution }, shoreField: maps.shoreField,
		points, webgpu: points.map( ( _, i ) => Array.from( query.cpu.slice( ( start + i ) * 4, ( start + i + 1 ) * 4 ) ) ),
	};
	const outputPath = resolve( output );
	await mkdir( dirname( outputPath ), { recursive: true } );
	await writeFile( outputPath, JSON.stringify( reference ) );
	console.log( `wrote ${points.length} Tidewater WebGPU shoreline query samples at ${time.toFixed( 2 )} s` );
} finally {
	surface.shore.dispose?.();
	terrainGPU.dispose();
	GPU.device.destroy();
}
