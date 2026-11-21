const clamp = ( value, min, max ) => Math.max( min, Math.min( max, value ) );
const smoothstep = ( edge0, edge1, value ) => {
	const t = clamp( ( value - edge0 ) / ( edge1 - edge0 ), 0, 1 );
	return t * t * ( 3 - 2 * t );
};

function dawnGain( hour ) {
	if ( ! Number.isFinite( hour ) ) return 0;
	return smoothstep( 5.0, 5.8, hour ) * ( 1 - smoothstep( 6.6, 7.9, hour ) );
}

function conditionGain( condition, { daylight, timeOfDay, underwater } ) {
	switch ( condition ) {
		case 'always': return 1;
		case 'night': return Number.isFinite( daylight ) ? 1 - clamp( daylight, 0, 1 ) : 0;
		case 'underwater': return underwater === true ? 1 : 0;
		case 'dawn': return dawnGain( timeOfDay );
		default: return 0;
	}
}

// Tidewater owns the meaning of its ambient bed labels. ElseMesh passes the
// destination world's resolved environment and consumes these numeric gains.
export function resolveTidewaterAmbientAudioGains( { data, components, daylight, timeOfDay, underwater } ) {
	const profile = new Map( ( data?.ambientAudio || [] ).map( entry => [ entry.assetId, entry.condition ] ) );
	const gains = {};
	for ( const component of components ) {
		const beds = component.beds.map( bed => conditionGain( profile.get( bed.assetId ) || 'always', { daylight, timeOfDay, underwater } ) );
		gains[ component.id ] = beds;
	}
	return gains;
}
