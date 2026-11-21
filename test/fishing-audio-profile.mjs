import assert from 'node:assert/strict';
import { TidewaterFishingAudio } from '../game/FishingAudio.js';

const calls = [];
const soundscape = {
	preloadSamples: names => calls.push( [ 'preload', names ] ),
	playSample: ( name, options ) => calls.push( [ 'play', name, options ] ),
	setSampleLoop: ( name, options ) => calls.push( [ 'loop', name, options ] ),
};
const profile = new TidewaterFishingAudio( soundscape );
const previousRandom = Math.random;
Math.random = () => 0.5;
try {
	profile.rodReady();
	assert.deepEqual( calls[ 0 ], [ 'preload', [ 'reel_wind', 'reel_drag', 'line_strain', 'rod_swish', 'bail_click', 'line_out', 'plop', 'line_snap', 'fish_splash', 'fish_flop' ] ], 'Tidewater declares its rod-ready sample set' );
	profile.whoosh( 0.5 );
	assert.deepEqual( calls[ 1 ], [ 'play', 'rod_swish', { targetLufs: - 34.5, rate: 1.03, category: 'rod', maxVoices: 4, position: null, refDistance: 1, channel: 'foreground', rolloff: 1 } ], 'cast strength controls the Tidewater cue level and pitch' );
	profile.plop( { x: 4, y: 0, z: - 3 } );
	assert.deepEqual( calls[ 2 ], [ 'play', 'plop', { targetLufs: - 30, rate: 1.025, category: 'fish', maxVoices: 3, position: [ 4, 0, - 3 ], refDistance: 4, channel: 'near', rolloff: 1 } ], 'bobber cues use Tidewater spatial placement' );
	calls.length = 0;
	profile.rodLoop( 1.4, 1, 1 );
	assert.deepEqual( calls, [
		[ 'loop', 'reel_wind', { targetLufs: - 36, weight: 1, rate: 1, channel: 'foreground', timeConstant: 0.08 } ],
		[ 'loop', 'reel_drag', { targetLufs: - 29, weight: 1, rate: 0.95, channel: 'foreground', timeConstant: 0.06 } ],
		[ 'loop', 'line_strain', { targetLufs: - 44, weight: 1, rate: 1.1, channel: 'foreground', timeConstant: 0.1 } ],
	], 'reel mixing stays in the Tidewater world profile');
	calls.length = 0;
	profile.stop();
	assert.ok( calls.every( ( [ type, , options ] ) => type === 'loop' && options.weight === 0 ), 'leaving the Tidewater behavior fades each reel loop out' );
} finally {
	Math.random = previousRandom;
}

console.log( 'Tidewater fishing audio profile uses generic engine sample playback' );
