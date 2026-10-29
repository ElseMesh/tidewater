import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { FishingGameRuntime } from '../../../src/game/FishingGameRuntime.js';
import { GameState } from '../../../src/game/GameState.js';
import { createFishingTestRuntime } from './fishing-test-extension.mjs';

// Golden trace captured from the pre-split WebGPU CatchMinigame at 23c30bf.
// Seed 0x71de feeds the same LCG stream used by the historical injectable RNG.
const BASELINE_SHA256 = 'c20f65ac33f533df05f12da7278a7b94f2c0929a0a30eccd899c967c29163d41';
const fishCatalog = JSON.parse( await readFile( new URL( '../fishing.json', import.meta.url ), 'utf8' ) ).fishCatalog;
const runtime = new FishingGameRuntime( {
	state: new GameState( { getItem: () => null, setItem() {} }, 'elsemesh:historical-parity', fishCatalog ),
	load: false,
	behaviorData: { fishCatalog },
} );
await createFishingTestRuntime( runtime, { fishCatalog } );
runtime.bite = { phase: 'take', species: 'grunt', kg: 0.8 };
await runtime.strike( { lineKg: 7, reelSpeed: 1.1, distance: 18, seed: 0x71de } );

const keys = [ 'species', 'kg', 'reelSpeed', 'power', 'staminaMax', 'stamina', 'distance', 'maxDistance', 'tension', 'surge', 'slack', 'time', 'band', 'overload', 'state' ];
const snapshot = fight => Object.fromEntries( keys.map( key => [ key, fight[ key ] ] ) );
const trace = [ snapshot( runtime.fight ) ];
let state = 'fighting', frames = 0;
while ( state === 'fighting' && frames < 60 * 180 ) {
	const fight = runtime.fight;
	const reeling = fight.tension < 0.68 && fight.surge < 0.6;
	const result = await runtime.stepFight( 1 / 60, reeling, 12 );
	state = result.state;
	trace.push( snapshot( result.fight ) );
	frames ++;
}

assert.equal( state, 'caught', 'the signed Worker reaches the historical terminal outcome' );
assert.equal( frames, 987, 'the signed Worker matches historical fight duration' );
assert.equal( createHash( 'sha256' ).update( JSON.stringify( trace ) ).digest( 'hex' ), BASELINE_SHA256, 'every fight snapshot matches the pre-split WebGPU trace' );
console.log( `Pre-split WebGPU fight parity passed (${frames} frames, 23c30bf)` );
