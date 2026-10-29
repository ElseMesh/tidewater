const SAMPLES_PER_HOUR = 10;
const HOURS_PER_DAY = 24;
const SAMPLE_COUNT = SAMPLES_PER_HOUR * HOURS_PER_DAY;
let fishCatalog = null;
let fight = null;

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

function seededRandom( fightState ) {
	fightState.randomState = ( Math.imul( fightState.randomState, 1664525 ) + 1013904223 ) >>> 0;
	return fightState.randomState / 0x100000000;
}

function startFight( event ) {
	if ( fight || typeof event.species !== 'string' || ! fishCatalog?.[ event.species ] || ! [ event.kg, event.lineKg, event.reelSpeed, event.distance ].every( Number.isFinite ) || event.kg <= 0 || event.lineKg <= 0 || event.reelSpeed <= 0 || event.distance < 0 || ! Number.isInteger( event.seed ) || event.seed < 0 || event.seed > 0xffffffff ) throw new Error( 'invalid fishing fight start' );
	const fish = fishCatalog[ event.species ];
	fight = {
		species: event.species,
		kg: event.kg,
		reelSpeed: event.reelSpeed,
		power: Math.min( 2.2, ( 0.25 + 0.75 * fish.fight ) * Math.pow( event.kg / Math.max( event.lineKg * 0.5, 0.2 ), 0.55 ) ),
		staminaMax: fish.stamina * Math.pow( Math.max( event.kg / fish.kg[ 1 ], 0.15 ), 0.35 ),
		stamina: 1,
		distance: event.distance,
		maxDistance: Math.max( 60, event.distance + 40 ),
		tension: 0.3,
		surge: 0,
		slack: 0,
		time: 0,
		band: [ 0.3, 0.85 ],
		overload: 0,
		randomState: event.seed >>> 0 || 0x6d2b79f5,
		_surgeT: 0,
		state: 'fighting',
	};
	fight._nextSurge = 1.2 + seededRandom( fight ) * 2;
	return snapshot();
}

function snapshot() {
	if ( ! fight ) return null;
	const { randomState, _surgeT, _nextSurge, ...publicState } = fight;
	return publicState;
}

function stepFight( event ) {
	if ( ! fight || ! Array.isArray( event.steps ) || event.steps.length < 1 || event.steps.length > 32 || event.steps.some( step => ! step || ! Number.isFinite( step.dt ) || step.dt < 0 || step.dt > 1 || typeof step.reeling !== 'boolean' ) ) throw new Error( 'invalid fishing fight steps' );
	const results = [];
	for ( const step of event.steps ) {
		const dt = step.dt;
		if ( fight.state !== 'fighting' ) break;
		fight.time += dt;
		const tired = 1 - fight.stamina;
		fight._nextSurge -= dt;
		if ( fight._nextSurge <= 0 && fight._surgeT <= 0 ) {
			fight._surgeT = 0.8 + seededRandom( fight ) * 1.2 * ( 1 - tired * 0.6 );
			fight._nextSurge = ( 2 + seededRandom( fight ) * 3 ) * ( 1 + tired );
		}
		fight._surgeT -= dt;
		const surgeTarget = fight._surgeT > 0 ? 1 : 0;
		fight.surge += ( surgeTarget - fight.surge ) * ( 1 - Math.exp( - dt * 6 ) );
		const pull = fight.power * ( 0.35 + 0.65 * fight.surge ) * ( 1 - 0.65 * tired );
		const target = step.reeling ? 0.25 + pull * 0.95 + 0.25 : pull * 0.72;
		const rate = step.reeling ? 2.2 : 3.0;
		fight.tension += ( target - fight.tension ) * ( 1 - Math.exp( - dt * rate ) );
		if ( step.reeling ) fight.distance -= fight.reelSpeed * dt * ( 1.15 - 0.6 * fight.surge * ( 1 - tired ) );
		else fight.distance += pull * 1.4 * dt;
		fight.distance = Math.max( 0, fight.distance );
		const inBand = fight.tension >= fight.band[ 0 ] && fight.tension <= fight.band[ 1 ];
		fight.stamina = Math.max( 0, fight.stamina - dt / fight.staminaMax * ( inBand ? 1 : 0.3 ) );
		fight.overload = fight.tension > 1 ? fight.overload + dt : Math.max( 0, fight.overload - dt * 2 );
		if ( fight.overload > 0.45 ) fight.state = 'snapped';
		else {
			fight.slack = fight.tension < 0.12 ? fight.slack + dt : Math.max( 0, fight.slack - dt * 2 );
			if ( fight.slack > 4 || fight.distance > fight.maxDistance ) fight.state = 'escaped';
			else if ( fight.distance < 1.2 ) fight.state = 'caught';
		}
		const result = { state: fight.state, fight: snapshot() };
		results.push( result );
		if ( fight.state !== 'fighting' ) { fight = null; break; }
	}
	return { results };
}

export function run( event ) {
	if ( event?.type === 'initialize' ) {
		if ( ! event.behaviorData || typeof event.behaviorData !== 'object' || Array.isArray( event.behaviorData ) || ! event.behaviorData.fishCatalog || typeof event.behaviorData.fishCatalog !== 'object' ) throw new Error( 'invalid fishing behavior initialization' );
		fishCatalog = event.behaviorData.fishCatalog;
		fight = null;
		return { biteRateMultipliers: compileBiteRateSchedule( event.behaviorData.biteRateSchedule ) };
	}
	if ( event?.type === 'start-fight' ) return { fight: startFight( event ) };
	if ( event?.type === 'step-fight' ) return stepFight( event );
	if ( event?.type === 'cancel' ) { fight = null; return { cancelled: true }; }
	throw new Error( 'invalid fishing behavior event' );
}
