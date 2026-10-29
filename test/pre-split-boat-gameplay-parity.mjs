import assert from 'node:assert/strict';
import { BoatGameplayRuntime } from '../../../src/game/BoatGameplayRuntime.js';
import { fuelBurn } from '../../../src/game/Gear.js';
import { GameState } from '../../../src/game/GameState.js';

// Reference the boat rules inline from Game.updateBoat/applyGear at pre-split
// commit 23c30bf. Compare those rules frame by frame with the shared runtime.
const makeStorage = () => {
	const writes = [];
	return { writes, setItem: ( key, value ) => writes.push( [ key, value ] ), getItem: () => null };
};
const oldStorage = makeStorage(), newStorage = makeStorage();
const oldState = new GameState( oldStorage ), newState = new GameState( newStorage );
oldState.money = newState.money = 1000;
const oldBoat = { maxThrust: 26000, pitchSpeed: 16, rpm: 0.9, throttle: 0.5, driven: false, position: { x: 4, z: 8 } };
const newBoat = { ...oldBoat, position: { ...oldBoat.position } };
const oldBase = { maxThrust: oldBoat.maxThrust, pitchSpeed: oldBoat.pitchSpeed };
const oldApplyGear = () => {
	oldBoat.maxThrust = oldBase.maxThrust * oldState.stats.speedMul ** 2;
	oldBoat.pitchSpeed = oldBase.pitchSpeed * oldState.stats.speedMul;
};
const runtime = new BoatGameplayRuntime( {
	state: newState,
	controller: newBoat,
	terrain: { heightAt: () => -12 },
	habitatAt: () => ( { reef: 0.7, pier: 0.2 } ),
	onFuelOut: () => { newFuelOut ++; },
} );
let oldFuelOut = 0, newFuelOut = 0;
oldState.onChange( oldApplyGear );
newState.onChange( () => runtime.applyGear() );
oldApplyGear();

for ( const state of [ oldState, newState ] ) {
	state.buy( 'engine' );
	state.buy( 'fishFinder' );
	state.fuel = 0.01;
}
oldApplyGear();

let oldSonarTimer = 0, oldSonar = null, oldWasDriven = false, oldFuelOutShown = false;
function historicalUpdateBoat( dt, mode ) {
	if ( oldBoat.driven ) {
		if ( oldState.burn( fuelBurn( oldBoat.rpm ) * dt ) <= 0 ) {
			oldBoat.throttle = 0;
			if ( ! oldFuelOutShown ) oldFuelOut ++;
			oldFuelOutShown = true;
		}
	} else if ( oldWasDriven ) oldState.save();
	oldWasDriven = oldBoat.driven;

	if ( ( mode === 'boat' || mode === 'deck' ) && oldState.stats.finder ) {
		oldSonarTimer -= dt;
		if ( oldSonarTimer <= 0 ) {
			oldSonarTimer = 0.5;
			const depth = Math.max( 0, - ( -12 ) );
			const habitat = { reef: 0.7, pier: 0.2 };
			let richness = 0;
			for ( const key in habitat ) richness += habitat[ key ];
			oldSonar = { depth, fish: Math.min( 1, richness / 1.4 ) };
		}
	}

	const aboard = mode === 'boat' || mode === 'deck';
	return { fuel: aboard ? { litres: oldState.fuelL, tank: oldState.stats.fuelL } : null, sonar: aboard && oldState.stats.finder ? oldSonar : null };
}

const frames = [
	{ dt: 0.1, mode: 'walk', driven: false },
	{ dt: 0.1, mode: 'boat', driven: false },
	{ dt: 0.2, mode: 'boat', driven: false },
	{ dt: 0.1, mode: 'walk', driven: false },
	{ dt: 0.05, mode: 'boat', driven: false }, // retains the last reading until its next half-second sample
	{ dt: 0.5, mode: 'deck', driven: true }, // fuel depletion and one out-of-fuel notification
	{ dt: 0.1, mode: 'boat', driven: true },
	{ dt: 1 / 60, mode: 'walk', driven: false }, // stopping saves fuel state
];

for ( const [ frame, input ] of frames.entries() ) {
	oldBoat.driven = newBoat.driven = input.driven;
	const expected = historicalUpdateBoat( input.dt, input.mode );
	const actual = runtime.step( input.dt, input.mode );
	assert.deepEqual( actual, expected, `HUD state matches pre-split behavior at frame ${frame}` );
	assert.deepEqual( newState.toJSON(), oldState.toJSON(), `saved gameplay state matches at frame ${frame}` );
	assert.equal( newBoat.maxThrust, oldBoat.maxThrust, `engine thrust matches at frame ${frame}` );
	assert.equal( newBoat.pitchSpeed, oldBoat.pitchSpeed, `engine pitch response matches at frame ${frame}` );
	assert.equal( newBoat.throttle, oldBoat.throttle, `throttle behavior matches at frame ${frame}` );
	assert.equal( newFuelOut, oldFuelOut, `fuel-out notification count matches at frame ${frame}` );
}

assert.deepEqual( newStorage.writes, oldStorage.writes, 'fuel and gear saves match the pre-split behavior' );
console.log( 'pre-split boat gameplay parity passed frame by frame' );
