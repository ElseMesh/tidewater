import { decodeWorldComponentAsset } from '../../../src/network/WorldComponentAssetCodecRegistry.js';
import { decodeGrassDensityAsset } from '../../../src/network/GrassDensityAsset.js';
import { registerWorldComponentBackendBatchAdapter } from '../../../src/network/WorldComponentBackendRegistry.js';
import { GroundCoverCellPlanner } from '../../../src/engine/render/GroundCoverCellPlanner.js';
import { createWebGLVegetationGroup } from './WebGLVegetationPresentation.js';

function bytesOf( value ) {
	if ( value instanceof Uint8Array ) return value;
	if ( value instanceof ArrayBuffer ) return new Uint8Array( value );
	if ( ArrayBuffer.isView( value ) ) return new Uint8Array( value.buffer, value.byteOffset, value.byteLength );
	throw new TypeError( 'Grass density asset is not binary data' );
}

function disposeGroup( fallback, group ) {

	const geometries = new Set(), materials = new Set(), textures = new Set();
	group.traverse( object => {
		if ( object.geometry?.dispose ) geometries.add( object.geometry );
		for ( const material of Array.isArray( object.material ) ? object.material : [ object.material ] ) {
			if ( ! material ) continue;
			materials.add( material );
			for ( const value of Object.values( material ) ) if ( value?.isTexture ) textures.add( value );
		}
	} );
	fallback.scene.remove( group );
	for ( const geometry of geometries ) geometry.dispose();
	for ( const material of materials ) material.dispose();
	for ( const texture of textures ) texture.dispose();

}

registerWorldComponentBackendBatchAdapter( 'webgl', 'elsemesh.static-vegetation/1', async ( { fallback, manifest, assets }, components ) => {

	const componentIDs = [], groups = [];
	const spawn = manifest.spawn?.position || [ 0, 0, 0 ];
	for ( const component of components ) {
		const placementBytes = assets.get( component.placementAssetId );
		const placementKind = component.assets?.find( asset => asset.assetId === component.placementAssetId )?.kind;
		const grassMaskAssetId = component.grassMaskAssetId;
		const grassMaskBytes = grassMaskAssetId && assets.get( grassMaskAssetId );
		if ( ! placementBytes || grassMaskAssetId && ! grassMaskBytes ) continue;
		if ( typeof placementKind !== 'string' ) throw new Error( `Static vegetation component ${component.id} does not declare its placement asset kind` );
		if ( grassMaskAssetId ) {
			fallback.hostedGrassMask = decodeGrassDensityAsset( bytesOf( grassMaskBytes ) );
			const terrain = fallback.hostedTerrainData || fallback.terrain;
			if ( ! terrain ) throw new Error( `Static grass component ${component.id} requires its terrain surface` );
			if ( fallback.hostedGrassMask.size !== terrain.size || fallback.hostedGrassMask.origin !== terrain.origin ) throw new Error( `Static grass component ${component.id} does not match its terrain surface` );
			fallback.grassCellPlanner = new GroundCoverCellPlanner( { terrain, density: fallback.hostedGrassMask } );
		}
		const records = decodeWorldComponentAsset( placementKind, bytesOf( placementBytes ), component.seed );
		fallback.vegetationRecords ||= {};
		for ( const [ kind, placements ] of Object.entries( records ) ) if ( Array.isArray( placements ) ) fallback.vegetationRecords[ kind ] = [ ...( fallback.vegetationRecords[ kind ] || [] ), ...placements ];
		const group = createWebGLVegetationGroup( fallback.THREE, records, [ spawn[ 0 ], spawn[ 2 ] ] );
		fallback.scene.add( group );
		groups.push( group );
		componentIDs.push( component.id );
	}
	if ( ! componentIDs.length ) return { componentIDs };
	return {
		componentIDs,
		runtimeComponentId: componentIDs[ 0 ],
		runtime: {
			update() {},
			dispose: () => { for ( const group of groups ) disposeGroup( fallback, group ); },
		},
	};

} );
