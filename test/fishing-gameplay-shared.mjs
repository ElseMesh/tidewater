import assert from 'node:assert/strict';
import { canFishInWorld, canInteractWithVendor, stepFishingBite, strikeFishing, stepFishingFight } from '../game/FishingGameplay.js';

assert.equal( canFishInWorld( { mode: 'walk' } ), true, 'walking allows fishing' );
assert.equal( canFishInWorld( { mode: 'deck' } ), true, 'a boat deck allows fishing' );
assert.equal( canFishInWorld( { mode: 'boat' } ), false, 'the helm does not allow fishing' );
assert.equal( canFishInWorld( { mode: 'walk', freeCam: true } ), false, 'free camera disables fishing' );
assert.equal( canFishInWorld( { mode: 'walk', photoMode: true } ), false, 'photo mode disables fishing for both renderers' );
assert.equal( canInteractWithVendor( { nearVendor: true } ), true, 'a nearby vendor can be opened' );
assert.equal( canInteractWithVendor( { nearVendor: true, fighting: true } ), false, 'a fish fight blocks vendor interaction in both renderers' );
assert.equal( canInteractWithVendor( { nearVendor: true, catchOpen: true } ), false, 'an open catch card blocks vendor interaction' );
assert.equal( canInteractWithVendor( { nearVendor: true, cardDismissed: true } ), false, 'catch-card dismissal input is not reused to open a vendor' );

const audioEvents = [], messages = [];
const audio = {
	fishSplash: ( _position, strength ) => audioEvents.push( [ 'splash', strength ] ),
	fishFlop: () => audioEvents.push( [ 'flop' ] ),
	lineSnap: () => audioEvents.push( [ 'snap' ] ),
};
const toast = ( ...args ) => messages.push( args );
const rod = {
	bobber: {}, dip: 0, lineOut: 12, state: 'floating',
	hook() { this.state = 'fighting'; },
	land() { this.state = 'landing'; },
	setState( state ) { this.state = state; },
	endFight() { this.state = 'idle'; },
};
let biteArgs;
await stepFishingBite( {
	runtime: { stepBite: async ( dt, options ) => { biteArgs = { dt, options }; return { event: 'take', dip: 0.7 }; } },
	rod, dt: 1 / 60, habitat: () => ( { reef: 0.5 } ), hour: 12, audio, toast,
} );
assert.equal( rod.dip, 0.7, 'a current floating-rod bite applies its dip' );
assert.deepEqual( biteArgs.options.habitat(), { reef: 0.5 }, 'the shared bite step keeps the live habitat callback' );
assert.equal( biteArgs.options.hour, 12, 'the shared bite step captures the supplied game hour' );
assert.deepEqual( audioEvents.at( - 1 ), [ 'splash', 0.35 ], 'the take cue is shared' );

let strikeArgs;
rod.state = 'floating';
const runtime = {
	bite: { phase: 'nibble' },
	strike: async args => { strikeArgs = args; return { state: 'fighting' }; },
};
assert.equal( await strikeFishing( { runtime, state: { stats: { lineKg: 4, reelSpeed: 2 } }, rod, toast } ), null, 'a nibble is not hooked' );
assert.deepEqual( messages.at( - 1 ), [ 'Not yet · wait for it to pull under', 1500 ], 'both adapters show the same early-strike message' );
runtime.bite = { phase: 'take' };
assert.deepEqual( await strikeFishing( { runtime, state: { stats: { lineKg: 4, reelSpeed: 2 } }, rod, toast } ), { state: 'fighting' }, 'a take starts a fight' );
assert.deepEqual( strikeArgs, { lineKg: 4, reelSpeed: 2, distance: 12 }, 'the shared strike uses the same gear and line distance' );
assert.equal( rod.state, 'fighting', 'the shared strike hooks the rod' );

const fightRod = { ...rod, state: 'fighting', dip: 0.8 };
let caughtPresentationState;
const caught = await stepFishingFight( {
	runtime: { stepFight: async ( dt, reeling, hour ) => { assert.equal( dt, 1 / 60 ); assert.equal( reeling, true ); assert.equal( hour, 18 ); return { fight: { surge: 0.8, kg: 2, species: 'grunt', _splashed: false }, state: 'caught', catchInfo: { value: 3 } }; } },
	rod: fightRod, dt: 1 / 60, reeling: true, hour: 18, audio, toast,
	onCaught: () => { caughtPresentationState = fightRod.state; },
} );
assert.equal( caught.state, 'caught', 'the shared fight step returns the terminal result to each presentation adapter' );
assert.equal( caughtPresentationState, 'fighting', 'renderer-specific catch presentation is attached before the shared rod transition' );
assert.equal( fightRod.state, 'landing', 'the shared caught transition lands the rod after presentation is attached' );
assert.equal( fightRod.dip, 0, 'terminal fight transitions clear rod dip' );
assert.deepEqual( audioEvents.slice( - 3 ), [ [ 'splash', 0.425 ], [ 'splash', 0.8 ], [ 'flop' ] ], 'fight surge and catch cues share their ordering' );

const snappedRod = { ...rod, state: 'fighting', dip: 0.5 };
await stepFishingFight( {
	runtime: { stepFight: async () => ( { fight: { surge: 0, kg: 1, species: 'grunt' }, state: 'snapped' } ) },
	rod: snappedRod, dt: 1 / 60, reeling: false, hour: 12, audio, toast,
} );
assert.equal( snappedRod.state, 'idle', 'a snapped fight resets the rod through the shared transition' );
assert.deepEqual( messages.at( - 1 ), [ 'Snap! The line broke', 2400 ], 'both renderers share the snap message' );
assert.deepEqual( audioEvents.at( - 1 ), [ 'snap' ], 'both renderers share the snap cue' );

console.log( 'Shared Tidewater gameplay transitions and photo-mode gate passed' );
