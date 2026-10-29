import { registerWorldComponent } from '../../src/network/WorldComponentRegistry.js';
import { registerWorldComponentAssetDecoder } from '../../src/network/WorldComponentAssetCodecRegistry.js';
import { registerWorldMaterialProfile } from '../../src/network/WorldMaterialProfileRegistry.js';
import { tidewaterComponentInstaller } from './component-installers.js';
import { decodeFishPropPlacements, FISH_PROP_PLACEMENT_ASSET_KIND } from './FishPropPlacements.js';
import * as fishPresentation from './FishPresentation.js';
import { VILLAGE_MATERIAL_MAPS, VILLAGE_MATERIAL_PROFILE, VILLAGE_MATERIAL_ROLES } from './VillageMaterialProfile.js';
import { decodeVillageMaterialAsset, VILLAGE_MATERIAL_ASSET_KIND } from './VillageMaterialAsset.js';
import './WorldPackageMaterialAdapter.js';
import './renderers/WebGPUFishPropsComponentAdapter.js';
import './renderers/WebGLFishPropsComponentAdapters.js';

registerWorldComponentAssetDecoder( FISH_PROP_PLACEMENT_ASSET_KIND, bytes => decodeFishPropPlacements( bytes, fishPresentation ) );
registerWorldComponentAssetDecoder( VILLAGE_MATERIAL_ASSET_KIND, decodeVillageMaterialAsset );
registerWorldMaterialProfile( VILLAGE_MATERIAL_PROFILE, { roles: VILLAGE_MATERIAL_ROLES, maps: VILLAGE_MATERIAL_MAPS } );

for ( const [ type, traits ] of [
	[ 'elsemesh.static-grass/1', {} ],
	[ 'elsemesh.static-reef/1', {} ],
	[ 'elsemesh.static-fish-props/1', {} ],
	[ 'elsemesh.humpback-whale/1', {} ],
	[ 'elsemesh.village-materials/1', {} ],
	[ 'elsemesh.village-materials/2', {} ],
	[ 'elsemesh.terrain-surface/1', { installRank: 0 } ],
	[ 'elsemesh.procedural-island-terrain/1', { installRank: 0 } ],
	[ 'elsemesh.procedural-island-vegetation/1', { vegetation: true, installRank: 1 } ],
	[ 'elsemesh.static-vegetation/1', { vegetation: true, installRank: 1 } ],
	[ 'elsemesh.downeast-boat/1', { installRank: 1, vehicle: true, complexityTriangles: 46845 } ],
	[ 'elsemesh.example-island-wildlife/1', { installRank: 2, wildlifeSimulation: true } ],
	[ 'elsemesh.island-ocean/1', { waterSurface: true } ],
] ) {
	const install = tidewaterComponentInstaller( type );
	registerWorldComponent( type, { ...traits, ...( install ? { install } : {} ) } );
}
