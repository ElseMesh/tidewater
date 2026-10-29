import { registerWorldPackageMaterialAdapter } from '../../src/network/WorldPackageMaterialAdapterRegistry.js';
import { decodeVillageMaterialAsset } from '../../src/network/VillageMaterialAsset.js';
import { VillageTextures } from '../../src/world/village/TextureBaker.js';
import { createVillageMaterials } from '../../src/world/village/VillageMaterials.js';

registerWorldPackageMaterialAdapter( 'elsemesh.village-materials/2', {
	async prepare( { connector, signal, component } ) {
		const packed = await connector.getAsset( component.dataAssetId, { signal } );
		if ( signal?.aborted ) throw signal.reason || new DOMException( 'World unloaded', 'AbortError' );
		const decoded = await decodeVillageMaterialAsset( packed );
		if ( signal?.aborted ) throw signal.reason || new DOMException( 'World unloaded', 'AbortError' );
		const textures = new VillageTextures( { bakedMaps: decoded.maps } );
		try {
			textures.prepareBakedMaps();
			const context = { textures, materials: createVillageMaterials( textures ) };
			return { context, dispose() {
				for ( const material of Object.values( context.materials ) ) material.dispose?.();
				textures.dispose();
			} };
		} catch ( error ) {
			textures.dispose();
			throw error;
		}
	},
	resolve( { profileRole, index, gltf, context, connector } ) {
		const role = profileRole;
		if ( ! role ) return null;
		if ( ! connector?.manifest?.rules?.requiredFeatures?.includes( 'elsemesh.village-materials/1' ) ) throw new Error( 'Village material profile is missing elsemesh.village-materials/1' );
		const vdata = gltf.meshes.flat().filter( primitive => primitive.material === index ).map( primitive => primitive.attributes._ELSEMESH_VDATA );
		if ( vdata.some( attribute => ! attribute || attribute.itemSize !== 4 ) ) throw new Error( `Village material ${role} requires a VEC4 _ELSEMESH_VDATA attribute` );
		if ( ! context?.materials?.[ role ] || typeof context.textures?.bake !== 'function' ) throw new Error( `Village material renderer is unavailable for ${role}` );
		const material = context.materials[ role ];
		material.userData ||= {};
		material.userData.borrowedWorldMaterial = true;
		return {
			material,
			prepareGeometry( geometry ) {
				const tint = geometry.getAttribute( 'color' );
				if ( ! tint ) throw new Error( `World material ${role} requires a COLOR_0 tint attribute` );
				geometry.setAttribute( 'tint', tint );
			},
			beforeRender: () => context.textures.bake(),
		};
	},
} );
