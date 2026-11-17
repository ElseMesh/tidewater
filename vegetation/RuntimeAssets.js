import { decodeGrassDensityAsset } from '../../../src/network/GrassDensityAsset.js';
import { decodeVegetationPlacements } from '../VegetationPlacements.js';

async function readAsset( assetURL, fetchAsset ) {

	if ( typeof assetURL !== 'string' || ! assetURL ) throw new Error( 'Tidewater vegetation component is missing a runtime asset URL' );
	const response = await fetchAsset( assetURL );
	if ( response instanceof Uint8Array ) return response;
	if ( response instanceof ArrayBuffer ) return new Uint8Array( response );
	if ( ! response?.ok ) throw new Error( `Tidewater vegetation asset request failed: ${response?.status ?? 'no response'}` );
	return new Uint8Array( await response.arrayBuffer() );

}

export async function loadTidewaterVegetationRuntimeAssets( component, assetURLs, fetchAsset = url => fetch( url ) ) {

	const data = component?.data || {};
	const references = new Map( ( component?.assets || [] ).map( asset => [ asset.assetId, asset.kind ] ) );
	const placementAssetId = data.placementAssetId;
	const grassMaskAssetId = data.grassMaskAssetId;
	if ( references.get( placementAssetId ) !== 'vegetation-placement/1' ) throw new Error( `Tidewater vegetation component ${component?.id || '(unknown)'} has no declared placement asset` );
	if ( references.get( grassMaskAssetId ) !== 'grass-density/1' ) throw new Error( `Tidewater vegetation component ${component?.id || '(unknown)'} has no declared grass-density asset` );
	const [ placementBytes, grassMaskBytes ] = await Promise.all( [
		readAsset( assetURLs?.[ placementAssetId ], fetchAsset ),
		readAsset( assetURLs?.[ grassMaskAssetId ], fetchAsset ),
	] );
	return {
		placementRecords: decodeVegetationPlacements( placementBytes, data.seed ),
		grassMask: decodeGrassDensityAsset( grassMaskBytes ),
	};

}
