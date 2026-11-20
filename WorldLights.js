// Presentation values moved from the former engine-owned village lights; they
// are not measurements or reconstructions of the source game's light actors.
const LIGHT_PROFILE = Object.freeze( {
	lantern: Object.freeze( { intensity: 1.5, range: 11, flicker: 0.08 } ),
	pathLight: Object.freeze( { intensity: 1, range: 7, flicker: 0.08 } ),
	window: Object.freeze( { intensity: 0.8, range: 6 } ),
} );

export function tidewaterLocalLightSet( village ) {
	const lights = [];
	for ( const authored of village.getLightSources() ) {
		const kind = authored.kind || 'lantern';
		const profile = LIGHT_PROFILE[ kind ] || { intensity: 1.2, range: 12 };
		const light = {
			position: authored.position.toArray(),
			color: authored.color.toArray(),
			intensity: authored.intensity * profile.intensity,
			range: profile.range,
			type: 'point',
			...( profile.flicker ? { flicker: profile.flicker } : {} ),
		};
		if ( kind === 'window' ) {
			let best = null, bestDistance = Infinity;
			for ( const building of village.buildings || [] ) {
				const distance = ( building.x - authored.position.x ) ** 2 + ( building.z - authored.position.z ) ** 2;
				if ( distance < bestDistance ) { bestDistance = distance; best = building; }
			}
			let dx = best ? authored.position.x - best.x : 0;
			let dz = best ? authored.position.z - best.z : 1;
			const length = Math.hypot( dx, dz ) || 1;
			dx /= length; dz /= length;
			light.position = [ authored.position.x + dx * 0.35, authored.position.y, authored.position.z + dz * 0.35 ];
			light.type = 'spot';
			light.direction = [ dx, 0, dz ];
			light.innerCone = Math.acos( 0.35 );
			light.outerCone = Math.acos( - 0.15 );
		}
		lights.push( light );
	}
	return lights;
}

// Renderer-neutral navigation and cabin lights authored in the boat's local frame.
export function tidewaterBoatLocalLights( boat ) {
	const lines = boat.lines;
	const sternY = lines.sheerY( 0 ) + 0.1;
	const objectId = 'elsemesh-object:moored-lobster-boat';
	const defs = [
		{ position: [ 0, 2.24, 0.42 ], color: [ 1.0, 0.84, 0.62 ], intensity: 0.9, range: 5.5 },
		{ position: [ - 0.45, 1.5, 1.12 ], color: [ 0.45, 0.75, 1.0 ], intensity: 0.12, range: 2.2 },
		{ position: [ 0.47, 3.45, - 0.47 ], direction: [ 1, 0, 0 ], color: [ 1.0, 0.06, 0.03 ], intensity: 1.4, range: 8 },
		{ position: [ - 0.47, 3.45, - 0.47 ], direction: [ - 1, 0, 0 ], color: [ 0.05, 1.0, 0.3 ], intensity: 1.4, range: 8 },
		{ position: [ 0, 3.97, - 0.5 ], color: [ 1.0, 0.95, 0.85 ], intensity: 1.2, range: 8 },
		{ position: [ 0, sternY, lines.zAft - 0.05 ], color: [ 1.0, 0.95, 0.85 ], intensity: 0.8, range: 7 },
	];
	return defs.map( light => ( {
		...light,
		objectId,
		type: light.direction ? 'spot' : 'point',
		...( light.direction ? { innerCone: Math.acos( 0.25 ), outerCone: Math.acos( - 0.2 ) } : {} ),
	} ) );
}
