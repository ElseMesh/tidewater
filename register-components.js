import { registerWorldComponent } from '../../src/network/WorldComponentRegistry.js';
import { registerWorldComponentAssetDecoder } from '../../src/network/WorldComponentAssetCodecRegistry.js';
import { registerWorldMaterialProfile } from '../../src/network/WorldMaterialProfileRegistry.js';
import { tidewaterComponentInstaller } from './component-installers.js';
import { decodeFishPropPlacements, FISH_PROP_PLACEMENT_ASSET_KIND } from './FishPropPlacements.js';
import { decodeVegetationPlacements } from './VegetationPlacements.js';
import { decodeReefPlacements } from './ReefPlacements.js';
import * as fishPresentation from './FishPresentation.js';
import { VILLAGE_MATERIAL_MAPS, VILLAGE_MATERIAL_PROFILE, VILLAGE_MATERIAL_ROLES } from './VillageMaterialProfile.js';
import { decodeVillageMaterialAsset, VILLAGE_MATERIAL_ASSET_KIND } from './VillageMaterialAsset.js';
import { TIDEWATER_WORLD_COMPONENTS } from './world-provider.js';
import { createHumpbackBrain } from './marine/HumpbackBrain.js';
import './WorldPackageMaterialAdapter.js';
import './renderers/WebGPUFishPropsComponentAdapter.js';
import './renderers/WebGLFishPropsComponentAdapter.js';
import './renderers/WebGLVegetationComponentAdapter.js';
import './renderers/WebGLReefComponentAdapter.js';
import './renderers/WebGLVillageMaterialComponentAdapter.js';
import './renderers/WebGLWildlifeComponentAdapter.js';
import './renderers/WebGLWhaleComponentAdapter.js';

registerWorldComponentAssetDecoder( FISH_PROP_PLACEMENT_ASSET_KIND, bytes => decodeFishPropPlacements( bytes, fishPresentation ) );
registerWorldComponentAssetDecoder( 'vegetation-placement/1', decodeVegetationPlacements );
registerWorldComponentAssetDecoder( 'reef-placement/1', decodeReefPlacements );
registerWorldComponentAssetDecoder( VILLAGE_MATERIAL_ASSET_KIND, decodeVillageMaterialAsset );
registerWorldMaterialProfile( VILLAGE_MATERIAL_PROFILE, { roles: VILLAGE_MATERIAL_ROLES, maps: VILLAGE_MATERIAL_MAPS } );

for ( const [ type, traits ] of TIDEWATER_WORLD_COMPONENTS ) {
	const install = tidewaterComponentInstaller( type );
	registerWorldComponent( type, { ...traits, ...( install ? { install } : {} ), ...( type === 'elsemesh.humpback-whale/1' ? { createSimulation: createHumpbackBrain } : {} ) } );
}
