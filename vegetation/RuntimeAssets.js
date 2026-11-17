import { decodeGrassDensityAsset } from '../../../src/network/GrassDensityAsset.js';
import { loadWorldComponentAssets } from '../../../src/network/WorldComponentAssets.js';
import { decodeVegetationPlacements } from '../VegetationPlacements.js';

export async function loadTidewaterVegetationRuntimeAssets( component, assetURLs, fetchAsset = url => fetch( url ) ) {

	const data = component?.data || {};
	const references = new Map( ( component?.assets || [] ).map( asset => [ asset.assetId, asset.kind ] ) );
	const placementAssetId = data.placementAssetId;
	const grassMaskAssetId = data.grassMaskAssetId;
	if ( references.get( placementAssetId ) !== 'vegetation-placement/1' ) throw new Error( `Tidewater vegetation component ${component?.id || '(unknown)'} has no declared placement asset` );
	if ( references.get( grassMaskAssetId ) !== 'grass-density/1' ) throw new Error( `Tidewater vegetation component ${component?.id || '(unknown)'} has no declared grass-density asset` );
	const assets = await loadWorldComponentAssets( [ component ], assetURLs, fetchAsset );
	return {
		placementRecords: decodeVegetationPlacements( assets.get( placementAssetId ), data.seed ),
		grassMask: decodeGrassDensityAsset( assets.get( grassMaskAssetId ) ),
	};

}
