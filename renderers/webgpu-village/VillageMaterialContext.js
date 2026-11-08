import { VillageTextures } from './TextureBaker.js';
import { createVillageMaterials } from './VillageMaterials.js';

export function createVillageMaterialContext( { bakedMaps } = {} ) {
	const textures = new VillageTextures( bakedMaps ? { bakedMaps } : undefined );
	try {
		if ( bakedMaps ) textures.prepareBakedMaps();
		return { textures, materials: createVillageMaterials( textures ) };
	} catch ( error ) {
		textures.dispose();
		throw error;
	}
}

export function disposeVillageMaterialContext( context ) {
	for ( const material of Object.values( context?.materials || {} ) ) material.dispose?.();
	context?.textures?.dispose();
}
