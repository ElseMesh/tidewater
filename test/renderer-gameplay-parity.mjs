import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../../../src/game/Game.js';
import { GameState } from '../../../src/game/GameState.js';
import { FishingGameRuntime } from '../../../src/game/FishingGameRuntime.js';
import { WebGLGameAdapter } from '../../../src/fallback/WebGLGameAdapter.js';

const experience = JSON.parse( readFileSync( new URL( '../world-source.json', import.meta.url ), 'utf8' ) ).experience;
const fishCatalog = experience.behaviors[ 'elsemesh.fishing-game/1' ].fishCatalog;
const storage = { getItem: () => null, setItem: () => {} };
const createAudio = () => {
	const events = [];
	return {
		events,
		fishSplash: ( _, strength ) => events.push( [ 'splash', strength ] ),
		fishFlop: () => events.push( [ 'flop' ] ),
		lineSnap: () => events.push( [ 'snap' ] ),
	};
};
const seededRandom = seed => () => {
	seed = ( seed * 1664525 + 1013904223 ) >>> 0;
	return seed / 0x100000000;
};
const fightSnapshot = runtime => {
	if ( ! runtime.fight ) return null;
	return Object.fromEntries( Object.entries( runtime.fight ).filter( ( [ key, value ] ) => key !== 'rng' && typeof value !== 'function' ) );
};

const webgpuRuntime = new FishingGameRuntime( {
	state: new GameState( storage, 'elsemesh:local', fishCatalog ), load: false, behaviorData: { fishCatalog },
} );
const webglRuntime = new FishingGameRuntime( {
	state: new GameState( storage, 'elsemesh:local', fishCatalog ), load: false, behaviorData: { fishCatalog },
} );
const webgpuAudio = createAudio(), webglAudio = createAudio();
const webgpuRod = {
	bobber: {}, dip: 0, lineOut: 18, state: 'floating',
	hook() { this.state = 'fighting'; }, land() { this.state = 'landing'; },
	setState( state ) { this.state = state; }, endFight() { this.state = 'idle'; },
};
const webglRod = { ...webgpuRod };
const webgpuToasts = [], webglToasts = [];
const webgpu = Object.assign( Object.create( Game.prototype ), {
	runtime: webgpuRuntime, state: webgpuRuntime.state, fishCatalog, rod: webgpuRod,
	app: { settings: { timeOfDay: 12 }, audio: webgpuAudio }, hud: {}, landing: null,
	toast: ( ...args ) => webgpuToasts.push( args ),
} );
const webgl = Object.assign( Object.create( WebGLGameAdapter.prototype ), {
	runtime: webglRuntime, state: webglRuntime.state, fishCatalog, rod: webglRod,
	audio: webglAudio, hud: {}, landing: null,
	toast: ( ...args ) => webglToasts.push( args ),
} );

// Start each renderer from the same authored hook state and random sequence.
for ( const [ runtime, game, seed ] of [ [ webgpuRuntime, webgpu, 0x71de ], [ webglRuntime, webgl, 0x71de ] ] ) {
	runtime.bite = { phase: 'take', species: 'grunt', kg: 0.8 };
	const previousRandom = Math.random;
	Math.random = seededRandom( seed );
	if ( game === webgpu ) game.strike();
	else game._strike();
	Math.random = previousRandom;
}
assert.equal( webgpuRod.state, webglRod.state, 'WebGPU and WebGL hook the same take' );
assert.equal( webgpuRuntime.bite, null );
assert.deepEqual( fightSnapshot( webgpuRuntime ), fightSnapshot( webglRuntime ), 'both renderers start the same deterministic fight' );

let frames = 0;
while ( webgpuRuntime.fight && webglRuntime.fight && frames < 60 * 180 ) {
	const reeling = webgpuRuntime.fight.tension < 0.68 && webgpuRuntime.fight.surge < 0.6;
	webgpu.updateFight( 1 / 60, reeling );
	webgl._stepFight( 1 / 60, reeling, 12 );
	assert.equal( webgpuRuntime.fight?.state, webglRuntime.fight?.state, `fight outcome agrees at frame ${frames}` );
	assert.deepEqual( fightSnapshot( webgpuRuntime ), fightSnapshot( webglRuntime ), `fight simulation agrees at frame ${frames}` );
	frames ++;
}
assert.ok( frames < 60 * 180, 'the deterministic encounter reaches an outcome' );
assert.equal( webgpuRod.state, webglRod.state, 'both renderers present the same terminal rod state' );
assert.deepEqual( webgpuRuntime.state.inventory, webglRuntime.state.inventory, 'both renderers record the same landed catch' );
assert.deepEqual( webgpuAudio.events, webglAudio.events, 'both renderers emit the same fight audio cues' );
assert.deepEqual( webgpuToasts, webglToasts, 'both renderers emit the same gameplay messages' );
assert.equal( webgpu.landing?.species, webgl.landing?.species, 'both renderers present the same landed species' );
assert.equal( webgpu.landing?.kg, webgl.landing?.kg, 'both renderers present the same landed weight' );
assert.deepEqual( webgpu.landing?.card, webgl.landing?.card, 'both renderers present the same catch card' );

console.log( `WebGPU/WebGL fishing trace parity passed (${frames} deterministic fight frames)` );
