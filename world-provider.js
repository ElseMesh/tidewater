export const TIDEWATER_WORLD_COMPONENTS = Object.freeze( [
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
] );

const behaviorIDs = new Set( [ 'elsemesh.fishing-game/1', 'elsemesh.shore-aware-boat/1' ] );
const componentTypes = new Set( TIDEWATER_WORLD_COMPONENTS.map( ( [ type ] ) => type ) );

export function supportsWorldManifest( manifest ) {
	return ( manifest?.components || [] ).some( component => componentTypes.has( component.type ) ) ||
		Object.keys( manifest?.experience?.behaviors || {} ).some( id => behaviorIDs.has( id ) );
}

export async function loadWorldProvider() {
	await import( './register-behavior.js' );
}
