// Renderer-neutral Tidewater fishing transitions shared by WebGPU and WebGL.
export function canFishInWorld( { mode, freeCam = false, photoMode = false } = {} ) {

	return ! freeCam && ! photoMode && ( mode === 'walk' || mode === 'deck' );

}

export function stepFishingBite( { runtime, rod, dt, habitat, hour, audio, toast } ) {

	return runtime.stepBite( dt, { habitat, hour } ).then( result => {
		if ( rod.state !== 'floating' ) return result;
		rod.dip = result.dip;
		if ( result.event === 'take' ) audio?.fishSplash?.( rod.bobber, 0.35 );
		if ( result.event === 'escaped' ) toast?.( 'It took the bait and ran', 1800 );
		return result;
	} );

}

export async function strikeFishing( { runtime, state, rod, toast } ) {

	const bite = runtime.bite;
	if ( ! bite || bite.phase === 'wait' || bite.phase === 'nibble' ) {
		if ( bite?.phase === 'nibble' ) toast?.( 'Not yet · wait for it to pull under', 1500 );
		return null;
	}
	if ( bite.phase !== 'take' ) return null;
	const stats = state.stats;
	const fight = await runtime.strike( { lineKg: stats.lineKg, reelSpeed: stats.reelSpeed, distance: Math.max( 3, rod.lineOut ) } );
	if ( ! fight ) return null;
	rod.hook();
	toast?.( 'Fish on!', 1200 );
	return fight;

}

export async function stepFishingFight( { runtime, rod, dt, reeling, hour, audio, toast, onCaught } ) {

	const result = await runtime.stepFight( dt, reeling, hour );
	const fight = result.fight, state = result.state;
	if ( ! fight || ! state ) return null;
	if ( fight.surge > 0.6 && ! fight._splashed ) audio?.fishSplash?.( rod.bobber, 0.3 + 0.5 * Math.min( 1, fight.kg / 8 ) );
	fight._splashed = fight.surge > 0.6 ? true : fight.surge < 0.3 ? false : fight._splashed;
	if ( state === 'fighting' ) return result;
	rod.dip = 0;
	if ( state === 'caught' ) {
		audio?.fishSplash?.( rod.bobber, 0.8 );
		audio?.fishFlop?.();
		onCaught?.( result );
		rod.land();
	} else if ( state === 'snapped' ) {
		toast?.( 'Snap! The line broke', 2400 );
		audio?.lineSnap?.();
		rod.setState( 'idle' );
	} else {
		toast?.( 'It threw the hook', 2000 );
		rod.endFight();
	}
	return result;

}
