import { registerWorldComponent } from '../../src/network/WorldComponentRegistry.js';
import { registerWorldComponentAssetDecoder } from '../../src/network/WorldComponentAssetCodecRegistry.js';
import { tidewaterComponentInstaller } from './component-installers.js';
import { decodeFishPropPlacements, FISH_PROP_PLACEMENT_ASSET_KIND } from './FishPropPlacements.js';
import * as fishPresentation from './FishPresentation.js';

registerWorldComponentAssetDecoder( FISH_PROP_PLACEMENT_ASSET_KIND, bytes => decodeFishPropPlacements( bytes, fishPresentation ) );

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
