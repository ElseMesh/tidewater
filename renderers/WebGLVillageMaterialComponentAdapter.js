import { decodeWorldComponentAsset } from '../../../src/network/WorldComponentAssetCodecRegistry.js';
import { registerWorldComponentBackendAdapter } from '../../../src/network/WorldComponentBackendRegistry.js';
import { createWebGLVillageMaterials, applyWebGLVillageMaterials } from './WebGLVillageMaterials.js';
import { VILLAGE_MATERIAL_PROFILE } from '../VillageMaterialProfile.js';

registerWorldComponentBackendAdapter( 'webgl', 'elsemesh.village-materials/2', installVillageMaterials );

async function installVillageMaterials( { fallback, assets }, component ) {
	const packed = assets.get( component.dataAssetId );
	if ( ! packed ) return false;
	let materials;
	try {
		const decoded = await decodeWorldComponentAsset( 'village-materials/1', packed );
		materials = createWebGLVillageMaterials( fallback.THREE, decoded, {
			anisotropy: fallback.renderer.capabilities.getMaxAnisotropy(),
		} );
	} catch ( error ) {
		console.warn( 'WebGL village material component unavailable:', error );
		return false;
	}
	const sharedMaterials = Object.values( materials );
	return {
		installed: true,
		runtime: {
			sharedMaterials,
			resolveWorldMaterialProfile: ( { profile, role } ) => profile === VILLAGE_MATERIAL_PROFILE ? materials[ role ] || null : null,
			applyObject: ( object, visual ) => object.id === component.objectId ? applyWebGLVillageMaterials( visual, materials ) : 0,
			dispose() {
				const textures = new Set();
				for ( const material of sharedMaterials ) {
					for ( const value of Object.values( material ) ) if ( value?.isTexture ) textures.add( value );
					material.dispose();
				}
				for ( const texture of textures ) texture.dispose();
			},
		},
	};
}
