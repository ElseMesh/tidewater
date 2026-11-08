const COMMERCE_TOAST_MS = 2600;

export function buyFishingUpgrade( runtime, key, toast ) {

	const result = runtime.buyUpgrade( key );
	if ( result ) toast?.( `${ result.name }: ${ result.label }`, COMMERCE_TOAST_MS );
	return result;

}

export function refuelFishingBoat( runtime, toast ) {

	const litres = runtime.refuel();
	if ( litres > 0 ) toast?.( `Filled up · ${ litres.toFixed( 0 ) } L`, COMMERCE_TOAST_MS );
	return litres;

}

export function sellAllFish( state, audio, toast ) {

	const result = state.sell();
	if ( result.count > 0 ) toast?.( `Sold ${ result.count } fish for $${ result.total }`, COMMERCE_TOAST_MS );
	// Preserve the authoritative WebGPU path's cue for an empty sale as well.
	audio?.coin?.();
	return result;

}

export function sellFish( state, ids, toast ) {

	const result = state.sell( ids );
	if ( result.count > 0 ) toast?.( `Sold for $${ result.total }`, COMMERCE_TOAST_MS );
	return result;

}
