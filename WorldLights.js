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
