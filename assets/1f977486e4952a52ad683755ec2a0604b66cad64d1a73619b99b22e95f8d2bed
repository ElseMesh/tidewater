const SAMPLES_PER_HOUR = 10;
const HOURS_PER_DAY = 24;
const SAMPLE_COUNT = SAMPLES_PER_HOUR * HOURS_PER_DAY;

function validHour( value ) {
	return Number.isFinite( value ) && value >= 0 && value <= HOURS_PER_DAY && Math.abs( value * SAMPLES_PER_HOUR - Math.round( value * SAMPLES_PER_HOUR ) ) < 1e-8;
}

function compileBiteRateSchedule( schedule ) {
	if ( schedule === undefined ) schedule = { defaultMultiplier: 1, windows: [] };
	if ( ! schedule || typeof schedule !== 'object' || Array.isArray( schedule ) || Object.keys( schedule ).some( key => ! [ 'defaultMultiplier', 'windows' ].includes( key ) ) || ! Number.isFinite( schedule.defaultMultiplier ) || schedule.defaultMultiplier < 0.5 || schedule.defaultMultiplier > 2 || ! Array.isArray( schedule.windows ) || schedule.windows.length > 16 ) throw new Error( 'invalid bite-rate schedule' );
	const samples = Array( SAMPLE_COUNT ).fill( schedule.defaultMultiplier );
	let previousEnd = - 1;
	for ( const window of schedule.windows ) {
		if ( ! window || typeof window !== 'object' || Array.isArray( window ) || Object.keys( window ).some( key => ! [ 'startHour', 'endHour', 'multiplier' ].includes( key ) ) || ! validHour( window.startHour ) || ! validHour( window.endHour ) || window.startHour >= window.endHour || window.startHour < previousEnd || ! Number.isFinite( window.multiplier ) || window.multiplier < 0.5 || window.multiplier > 2 ) throw new Error( 'invalid bite-rate schedule window' );
		previousEnd = window.endHour;
		for ( let sample = window.startHour * SAMPLES_PER_HOUR; sample < window.endHour * SAMPLES_PER_HOUR; sample ++ ) samples[ sample ] = window.multiplier;
	}
	return samples;
}

export function run( event ) {
	if ( event?.type !== 'initialize' || ! event.behaviorData || typeof event.behaviorData !== 'object' || Array.isArray( event.behaviorData ) ) throw new Error( 'invalid fishing behavior initialization' );
	return { biteRateMultipliers: compileBiteRateSchedule( event.behaviorData.biteRateSchedule ) };
}
