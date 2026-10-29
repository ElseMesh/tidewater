const SAMPLES_PER_HOUR = 10;
const HOURS_PER_DAY = 24;
const SAMPLE_COUNT = SAMPLES_PER_HOUR * HOURS_PER_DAY;
let fishCatalog = null;
let fight = null;
let bite = null;
let biteRateMultipliers = Array( SAMPLE_COUNT ).fill( 1 );

const HABITATS = [ 'shallows', 'reef', 'pier', 'bay', 'deep' ];

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

function activity( preference, hour ) {
	const dawn = Math.exp( - ( ( hour - 6.5 ) ** 2 ) / 2.5 );
	const dusk = Math.exp( - ( ( hour - 18.5 ) ** 2 ) / 2.5 );
	const night = hour < 5.5 || hour > 19.5 ? 1 : 0;
	const day = hour > 7 && hour < 18 ? 1 : 0.35;
	switch ( preference ) {
		case 'day': return 0.25 + 0.75 * day * ( 1 - night );
		case 'dawnDusk': return 0.3 + 0.7 * Math.max( dawn, dusk ) + 0.1 * day;
		case 'night': return 0.15 + 0.85 * Math.max( night, dusk * 0.8 );
		default: return 0.8 + 0.2 * Math.max( dawn, dusk );
	}
}

function pickSpecies( habitat, hour, rng ) {
	const ids = Object.keys( fishCatalog );
	const weights = [];
	let total = 0;
	for ( const id of ids ) {
		const fish = fishCatalog[ id ];
		let habitatWeight = 0;
		for ( const key of HABITATS ) habitatWeight += ( fish.habitat[ key ] || 0 ) * ( habitat[ key ] || 0 );
		const weight = habitatWeight * fish.rarity * activity( fish.time, hour );
		weights.push( weight );
		total += weight;
	}
	if ( total < 1e-4 ) return null;
	let selected = rng() * total;
	for ( let index = 0; index < weights.length; index ++ ) {
		selected -= weights[ index ];
		if ( selected <= 0 ) return ids[ index ];
	}
	return ids[ ids.length - 1 ];
}

function biteDelay( habitat, hour, rng ) {
	let richness = 0;
	for ( const key of HABITATS ) richness += habitat[ key ] || 0;
	if ( richness < 0.05 ) return Infinity;
	richness = Math.max( richness, 0.35 );
	const light = hour > 6 && hour < 19 ? 1 : 0.8;
	const mean = 8 / ( Math.min( richness, 1.6 ) * light );
	return 2 + -Math.log( 1 - rng() * 0.98 ) * mean * 0.6;
}

function validateHabitat( habitat ) {
	return habitat && typeof habitat === 'object' && ! Array.isArray( habitat ) && Object.keys( habitat ).every( key => HABITATS.includes( key ) && Number.isFinite( habitat[ key ] ) && habitat[ key ] >= 0 && habitat[ key ] <= 1 );
}

function biteSnapshot() {
	if ( ! bite ) return null;
	const { randomState, ...state } = bite;
	return { ...state, t: Number.isFinite( bite.t ) ? bite.t : null };
}

function startBite( event ) {
	if ( ! validateHabitat( event.habitat ) || ! Number.isFinite( event.hour ) || event.hour < 0 || event.hour > 24 || ! Number.isInteger( event.seed ) || event.seed < 0 || event.seed > 0xffffffff ) throw new Error( 'invalid fishing bite start' );
	bite = { phase: 'wait', t: 0, dip: 0, randomState: event.seed >>> 0 || 0x6d2b79f5 };
	const rng = () => seededRandom( bite );
	bite.t = biteDelay( event.habitat, event.hour, rng );
	return { bite: biteSnapshot() };
}

function stepOneBite( step ) {
	if ( !bite ) return { bite: null, dip: 0, event: null };
	if ( !Number.isFinite( step.dt ) || step.dt < 0 || step.dt > 1 || !Number.isFinite( step.hour ) || step.hour < 0 || step.hour > 24 || !validateHabitat( step.habitat ) ) throw new Error( 'invalid fishing bite step' );
	const hour = ( step.hour % 24 + 24 ) % 24;
	const multiplier = biteRateMultipliers[ Math.min( SAMPLE_COUNT - 1, Math.floor( hour * SAMPLES_PER_HOUR ) ) ];
	bite.t -= step.dt * ( bite.phase === 'wait' ? multiplier : 1 );
	if ( bite.phase === 'nibble' ) bite.dip = Math.max( 0, Math.sin( Math.min( 1, bite.pulse || 0 ) * Math.PI ) * 0.45 );
	else if ( bite.phase === 'take' ) bite.dip += ( 1.4 - bite.dip ) * ( 1 - Math.exp( - step.dt * 14 ) );
	else bite.dip = Math.max( 0, bite.dip - step.dt * 3 );
	if ( bite.phase === 'nibble' ) bite.pulse = ( bite.pulse || 0 ) + step.dt * 3.2;
	if ( bite.t > 0 ) return { bite: biteSnapshot(), dip: bite.dip, event: null };
	const rng = () => seededRandom( bite );
	if ( bite.phase === 'wait' ) {
		const species = pickSpecies( step.habitat, hour, rng );
		if ( !species ) { bite.t = 8; return { bite: biteSnapshot(), dip: bite.dip, event: null }; }
		const fish = fishCatalog[ species ];
		const [ minKg, maxKg ] = fish.kg;
		bite.species = species;
		bite.kg = minKg + ( maxKg - minKg ) * Math.pow( rng(), 2.2 );
		bite.phase = 'nibble';
		bite.nibbles = 1 + Math.floor( rng() * 3 );
		bite.t = 0.7 + rng() * 0.8;
		bite.pulse = 0;
		return { bite: biteSnapshot(), dip: bite.dip, event: null };
	}
	if ( bite.phase === 'nibble' ) {
		bite.nibbles --;
		bite.pulse = 0;
		if ( bite.nibbles > 0 ) bite.t = 0.6 + rng();
		else {
			bite.phase = 'take';
			bite.t = 2.4 - fishCatalog[ bite.species ].fight * 0.5;
			return { bite: biteSnapshot(), dip: bite.dip, event: 'take' };
		}
		return { bite: biteSnapshot(), dip: bite.dip, event: null };
	}
	if ( bite.phase === 'take' ) {
		const habitat = step.habitat;
		bite = { phase: 'wait', t: biteDelay( habitat, hour, rng ), dip: bite.dip, randomState: bite.randomState };
		return { bite: biteSnapshot(), dip: bite.dip, event: 'escaped' };
	}
	throw new Error( `Unknown fishing bite phase: ${ bite.phase }` );
}

function stepBite( event ) {
	if ( !Array.isArray( event.steps ) || event.steps.length < 1 || event.steps.length > 32 ) throw new Error( 'invalid fishing bite steps' );
	return { results: event.steps.map( stepOneBite ) };
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
		bite = null;
		biteRateMultipliers = compileBiteRateSchedule( event.behaviorData.biteRateSchedule );
		return { initialized: true };
	}
	if ( event?.type === 'start-bite' ) return startBite( event );
	if ( event?.type === 'step-bite' ) return stepBite( event );
	if ( event?.type === 'start-fight' ) return { fight: startFight( event ) };
	if ( event?.type === 'step-fight' ) return stepFight( event );
	if ( event?.type === 'cancel' ) { bite = null; fight = null; return { cancelled: true }; }
	throw new Error( 'invalid fishing behavior event' );
}
