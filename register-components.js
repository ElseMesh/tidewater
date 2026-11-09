import { registerWorldComponent } from '../../src/network/WorldComponentRegistry.js';
import { registerWorldComponentAssetDecoder } from '../../src/network/WorldComponentAssetCodecRegistry.js';
import { tidewaterComponentInstaller } from './component-installers.js';
import { decodeFishPropPlacements, FISH_PROP_PLACEMENT_ASSET_KIND } from './FishPropPlacements.js';
import { decodeVegetationPlacements } from './VegetationPlacements.js';
import { decodeReefPlacements } from './ReefPlacements.js';
import * as fishPresentation from './FishPresentation.js';
import { TIDEWATER_WORLD_COMPONENTS } from './world-provider.js';
import { createHumpbackBrain } from './marine/HumpbackBrain.js';
import './renderers/WebGLVegetationComponentAdapter.js';
import './renderers/WebGLReefComponentAdapter.js';
import './renderers/WebGLWildlifeComponentAdapter.js';
import './renderers/WebGLWhaleComponentAdapter.js';

registerWorldComponentAssetDecoder( FISH_PROP_PLACEMENT_ASSET_KIND, bytes => decodeFishPropPlacements( bytes, fishPresentation ) );
registerWorldComponentAssetDecoder( 'vegetation-placement/1', decodeVegetationPlacements );
registerWorldComponentAssetDecoder( 'reef-placement/1', decodeReefPlacements );

for ( const [ type, traits ] of TIDEWATER_WORLD_COMPONENTS ) {
	const install = tidewaterComponentInstaller( type );
	registerWorldComponent( type, { ...traits, ...( install ? { install } : {} ), ...( type === 'elsemesh.humpback-whale/1' ? { createSimulation: createHumpbackBrain } : {} ) } );
}
