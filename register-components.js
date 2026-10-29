import { registerWorldComponent } from '../../src/network/WorldComponentRegistry.js';

for ( const type of [
	'elsemesh.procedural-island-vegetation/1',
	'elsemesh.static-grass/1',
	'elsemesh.static-reef/1',
	'elsemesh.static-fish-props/1',
	'elsemesh.humpback-whale/1',
	'elsemesh.village-materials/1',
	'elsemesh.village-materials/2',
] ) registerWorldComponent( type );

registerWorldComponent( 'elsemesh.terrain-surface/1', { installRank: 0 } );
registerWorldComponent( 'elsemesh.procedural-island-terrain/1', { installRank: 0 } );
registerWorldComponent( 'elsemesh.static-vegetation/1', { installRank: 1 } );
registerWorldComponent( 'elsemesh.downeast-boat/1', { installRank: 1 } );
registerWorldComponent( 'elsemesh.example-island-wildlife/1', { installRank: 2 } );
registerWorldComponent( 'elsemesh.island-ocean/1', { waterSurface: true } );
