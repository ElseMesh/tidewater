import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import source from '../world-source.json' with { type: 'json' };
import { decodeVegetationPlacements } from '../VegetationPlacements.js';
import { loadTidewaterVegetationRuntimeAssets } from '../vegetation/RuntimeAssets.js';

const component = source.components.find( entry => entry.type === 'elsemesh.static-vegetation/1' );
assert.ok( component, 'Tidewater world source declares its vegetation component' );
const bytesFor = async url => {
	const id = url.slice( 'asset:'.length );
	return readFile( new URL( `../assets/${id.slice( 'sha256:'.length )}`, import.meta.url ) );
};
const assetURLs = Object.fromEntries( component.assets.map( asset => [ asset.assetId, `asset:${asset.assetId}` ] ) );
const { placementRecords, grassMask } = await loadTidewaterVegetationRuntimeAssets( component, assetURLs, bytesFor );
const placementAsset = component.assets.find( asset => asset.kind === 'vegetation-placement/1' );
const placementBytes = new Uint8Array( await bytesFor( assetURLs[ placementAsset.assetId ] ) );
assert.deepEqual(
	placementRecords,
	decodeVegetationPlacements( placementBytes, component.data.seed ),
	'built-in WebGPU and the registered WebGL adapter consume the same signed placement records',
);
assert.equal( grassMask.res, 1024, 'built-in WebGPU consumes the signed density resolution used by WebGL' );
assert.equal( grassMask.size, 2048, 'built-in WebGPU consumes the signed density world size used by WebGL' );
assert.equal( grassMask.origin, -1024, 'built-in WebGPU consumes the signed density origin used by WebGL' );
assert.ok( grassMask.data.some( value => value > 0 ), 'the signed grass-density asset contains authored occupancy' );
await assert.rejects(
	loadTidewaterVegetationRuntimeAssets( { ...component, assets: [] }, assetURLs, bytesFor ),
	/no declared placement asset/,
	'missing signed placement data fails instead of silently regenerating backend-specific placements',
);

console.log( 'Tidewater built-in vegetation uses its signed placement and grass-density assets' );
