import { loadWorldComponentAssets } from '../../../src/network/WorldComponentAssets.js';
import { decodeVegetationPlacements } from '../VegetationPlacements.js';

export async function loadTidewaterVegetationRuntimeAssets( component, assetURLs, fetchAsset = url => fetch( url ) ) {

	const data = component?.data || {};
	const references = new Map( ( component?.assets || [] ).map( asset => [ asset.assetId, asset.kind ] ) );
	const placementAssetId = data.placementAssetId;
	if ( references.get( placementAssetId ) !== 'vegetation-placement/1' ) throw new Error( `Tidewater vegetation component ${component?.id || '(unknown)'} has no declared placement asset` );
	const assets = await loadWorldComponentAssets( [ component ], assetURLs, fetchAsset );
	return {
		placementRecords: decodeVegetationPlacements( assets.get( placementAssetId ), data.seed ),
	};

}
