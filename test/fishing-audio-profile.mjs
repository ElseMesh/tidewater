import assert from 'node:assert/strict';
import { TidewaterFishingAudio } from '../game/FishingAudio.js';
import { SoundScape } from '../../../src/audio/SoundScape.js';

const engine = new SoundScape();
new TidewaterFishingAudio( engine );
for ( const name of [ 'reel_wind', 'rod_swish', 'coins' ] ) assert.ok( engine._sampleInfo.has( `world.tidewater.fishing:${name}` ), `ElseMesh registers Tidewater's world-owned sample ${name}` );

const calls = [];
const registrations = [];
const soundscape = {
	registerSampleBank: ( namespace, bank ) => {
		registrations.push( [ namespace, bank ] );
		return Object.fromEntries( Object.keys( bank ).map( name => [ name, `${namespace}:${name}` ] ) );
	},
	preloadSamples: names => calls.push( [ 'preload', names ] ),
	playSample: ( name, options ) => calls.push( [ 'play', name, options ] ),
	setSampleLoop: ( name, options ) => calls.push( [ 'loop', name, options ] ),
};
const profile = new TidewaterFishingAudio( soundscape );
const previousRandom = Math.random;
Math.random = () => 0.5;
try {
	assert.equal( registrations[ 0 ][ 0 ], 'world.tidewater.fishing', 'Tidewater registers its namespaced sample bank with ElseMesh' );
	assert.ok( registrations[ 0 ][ 1 ].rod_swish && registrations[ 0 ][ 1 ].reel_wind, 'the world-owned bank supplies both sprites and loops' );
	profile.rodReady();
	assert.deepEqual( calls[ 0 ], [ 'preload', [ 'world.tidewater.fishing:reel_wind', 'world.tidewater.fishing:reel_drag', 'world.tidewater.fishing:line_strain', 'world.tidewater.fishing:rod_swish', 'world.tidewater.fishing:bail_click', 'world.tidewater.fishing:line_out', 'world.tidewater.fishing:plop', 'world.tidewater.fishing:line_snap', 'world.tidewater.fishing:fish_splash', 'world.tidewater.fishing:fish_flop' ] ], 'Tidewater declares its rod-ready sample set' );
	profile.whoosh( 0.5 );
	assert.deepEqual( calls[ 1 ], [ 'play', 'world.tidewater.fishing:rod_swish', { targetLufs: - 34.5, rate: 1.03, category: 'rod', maxVoices: 4, position: null, refDistance: 1, channel: 'foreground', rolloff: 1 } ], 'cast strength controls the Tidewater cue level and pitch' );
	profile.plop( { x: 4, y: 0, z: - 3 } );
	assert.deepEqual( calls[ 2 ], [ 'play', 'world.tidewater.fishing:plop', { targetLufs: - 30, rate: 1.025, category: 'fish', maxVoices: 3, position: [ 4, 0, - 3 ], refDistance: 4, channel: 'near', rolloff: 1 } ], 'bobber cues use Tidewater spatial placement' );
	calls.length = 0;
	profile.rodLoop( 1.4, 1, 1 );
	assert.deepEqual( calls, [
		[ 'loop', 'world.tidewater.fishing:reel_wind', { targetLufs: - 36, weight: 1, rate: 1, channel: 'foreground', timeConstant: 0.08 } ],
		[ 'loop', 'world.tidewater.fishing:reel_drag', { targetLufs: - 29, weight: 1, rate: 0.95, channel: 'foreground', timeConstant: 0.06 } ],
		[ 'loop', 'world.tidewater.fishing:line_strain', { targetLufs: - 44, weight: 1, rate: 1.1, channel: 'foreground', timeConstant: 0.1 } ],
	], 'reel mixing stays in the Tidewater world profile');
	calls.length = 0;
	profile.stop();
	assert.ok( calls.every( ( [ type, , options ] ) => type === 'loop' && options.weight === 0 ), 'leaving the Tidewater behavior fades each reel loop out' );
} finally {
	Math.random = previousRandom;
}

console.log( 'Tidewater fishing audio profile uses generic engine sample playback' );
