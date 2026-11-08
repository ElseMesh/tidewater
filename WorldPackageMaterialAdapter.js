import { registerWorldPackageMaterialAdapter } from '../../src/network/WorldPackageMaterialAdapterRegistry.js';
import { decodeWorldComponentAsset } from '../../src/network/WorldComponentAssetCodecRegistry.js';
import { createVillageMaterialContext, disposeVillageMaterialContext } from './renderers/webgpu-village/VillageMaterialContext.js';
import { createStaticPropMaterial } from './fish/FishMaterial.js';
import * as fishPresentation from './FishPresentation.js';
import { FISH_PROP_MATERIAL_COMPONENT, FISH_PROP_MATERIAL_DESCRIPTOR, FISH_PROP_MATERIAL_PROFILE } from './FishPropMaterialProfile.js';
import { VILLAGE_MATERIAL_ROLES } from './VillageMaterialProfile.js';

registerWorldPackageMaterialAdapter( 'elsemesh.village-materials/2', {
	async prepare( { connector, signal, component } ) {
		const packed = await connector.getAsset( component.dataAssetId, { signal } );
		if ( signal?.aborted ) throw signal.reason || new DOMException( 'World unloaded', 'AbortError' );
		const decoded = await decodeWorldComponentAsset( 'village-materials/1', packed );
		if ( signal?.aborted ) throw signal.reason || new DOMException( 'World unloaded', 'AbortError' );
		const context = createVillageMaterialContext( { bakedMaps: decoded.maps } );
		return { context, dispose: () => disposeVillageMaterialContext( context ) };
	},
	resolve( { profileRole, index, gltf, context, connector } ) {
		const role = profileRole;
		if ( ! role || ! VILLAGE_MATERIAL_ROLES.includes( role ) ) return null;
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

registerWorldPackageMaterialAdapter( FISH_PROP_MATERIAL_COMPONENT, {
	async prepare( { component } ) {
		if ( component.data?.profile !== FISH_PROP_MATERIAL_DESCRIPTOR ) throw new Error( 'Tidewater fish material component has an unsupported presentation profile' );
		const material = createStaticPropMaterial( fishPresentation );
		material.userData.borrowedWorldMaterial = true;
		return { context: { material }, dispose: () => material.dispose() };
	},
	resolve( { profileRole, context, connector } ) {
		if ( ! profileRole ) return null;
		if ( profileRole !== 'prop' ) throw new Error( `Unsupported Tidewater fish material role: ${profileRole}` );
		if ( ! connector?.manifest?.rules?.requiredFeatures?.includes( FISH_PROP_MATERIAL_COMPONENT ) ) throw new Error( 'Tidewater fish material profile is missing its required feature' );
		if ( ! context?.material ) throw new Error( 'Tidewater fish material renderer is unavailable' );
		return {
			material: context.material,
			prepareGeometry( geometry ) {
				const data = geometry.getAttribute( 'vdata' );
				if ( ! data || data.itemSize !== 4 ) throw new Error( 'Tidewater fish props require a VEC4 _ELSEMESH_VDATA attribute' );
				geometry.setAttribute( 'aData', data );
			},
		};
	},
} );
