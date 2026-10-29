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

// Golden bite trace captured from pre-split Bites.js/Game.updateBite at 23c30bf.
// The same seeded LCG stream is injected to make species, size, and phase timing comparable.
const BITE_BASELINE_SHA256 = 'cc316e8d6a85097ef248015f2efda89c412bc6af6de068ca4d7f2ea6193e1fe0';
const biteRuntime = new FishingGameRuntime( {
	state: new GameState( { getItem: () => null, setItem() {} }, 'elsemesh:historical-bite-parity', fishCatalog ),
	load: false,
	behaviorData: { fishCatalog },
} );
await createFishingTestRuntime( biteRuntime, { fishCatalog } );
const habitat = { shallows: 0.6, reef: 0.1, pier: 0.7, bay: 0.8, deep: 0 };
await biteRuntime.startBite( habitat, 12, 0x71de );
const biteTrace = [];
const biteKeys = [ 'phase', 't', 'species', 'kg', 'nibbles', 'pulse' ];
for ( let frame = 0; frame < 2400; frame ++ ) {
	const dt = 1 / 60 + ( frame % 7 ) * 0.001;
	const hour = ( 12 + frame / 3600 ) % 24;
	const result = await biteRuntime.stepBite( dt, { habitat, hour } );
	const bite = Object.fromEntries( biteKeys.map( key => [ key, result.bite?.[ key ] ?? null ] ) );
	biteTrace.push( { bite, dip: result.dip, event: result.event } );
}
assert.equal( createHash( 'sha256' ).update( JSON.stringify( biteTrace ) ).digest( 'hex' ), BITE_BASELINE_SHA256, 'species, weight, bite phases, dip, and timing match the pre-split WebGPU trace' );
console.log( 'Pre-split WebGPU bite parity passed (2400 frames, 23c30bf)' );
