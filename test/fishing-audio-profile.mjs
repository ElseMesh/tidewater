import assert from 'node:assert/strict';
import { TidewaterFishingAudio } from '../game/FishingAudio.js';
import { SoundScape } from '../../../src/audio/SoundScape.js';

const engine = new SoundScape();
const engineProfile = new TidewaterFishingAudio( engine );
assert.equal( engine._activeSampleBank, '', 'registering Tidewater content does not change the active world' );
for ( const name of [ 'reel_wind', 'rod_swish', 'coins', 'surf_far' ] ) assert.ok( engine._sampleInfo.has( `world.tidewater:${name}` ), `ElseMesh registers Tidewater's world-owned sample ${name}` );
engineProfile.activate();
assert.equal( engine._activeSampleBank, 'world.tidewater', 'the active Tidewater world selects its sample bank' );
engineProfile.deactivate();
assert.equal( engine._activeSampleBank, '', 'leaving Tidewater releases its sample bank' );

const calls = [];
const registrations = [];
const soundscape = {
	registerSampleBank: ( namespace, bank ) => {
		registrations.push( [ namespace, bank ] );
		return Object.fromEntries( Object.keys( bank ).map( name => [ name, `${namespace}:${name}` ] ) );
	},
	setActiveSampleBank: namespace => calls.push( [ 'active-bank', namespace ] ),
	preloadSamples: names => calls.push( [ 'preload', names ] ),
	playSample: ( name, options ) => calls.push( [ 'play', name, options ] ),
	setSampleLoop: ( name, options ) => calls.push( [ 'loop', name, options ] ),
};
const profile = new TidewaterFishingAudio( soundscape );
const previousRandom = Math.random;
Math.random = () => 0.5;
try {
	assert.equal( registrations[ 0 ][ 0 ], 'world.tidewater', 'Tidewater registers its namespaced sample bank with ElseMesh' );
	assert.ok( registrations[ 0 ][ 1 ].rod_swish && registrations[ 0 ][ 1 ].reel_wind && registrations[ 0 ][ 1 ].surf_far, 'the world-owned bank supplies its effects and ambience' );
	profile.activate();
	assert.deepEqual( calls[ 0 ], [ 'active-bank', 'world.tidewater' ], 'Tidewater selects its bank when activated' );
	profile.rodReady();
	assert.deepEqual( calls[ 1 ], [ 'preload', [ 'world.tidewater:reel_wind', 'world.tidewater:reel_drag', 'world.tidewater:line_strain', 'world.tidewater:rod_swish', 'world.tidewater:bail_click', 'world.tidewater:line_out', 'world.tidewater:plop', 'world.tidewater:line_snap', 'world.tidewater:fish_splash', 'world.tidewater:fish_flop' ] ], 'Tidewater declares its rod-ready sample set' );
	profile.whoosh( 0.5 );
	assert.deepEqual( calls[ 2 ], [ 'play', 'world.tidewater:rod_swish', { targetLufs: - 34.5, rate: 1.03, category: 'rod', maxVoices: 4, position: null, refDistance: 1, channel: 'foreground', rolloff: 1 } ], 'cast strength controls the Tidewater cue level and pitch' );
	profile.plop( { x: 4, y: 0, z: - 3 } );
	assert.deepEqual( calls[ 3 ], [ 'play', 'world.tidewater:plop', { targetLufs: - 30, rate: 1.025, category: 'fish', maxVoices: 3, position: [ 4, 0, - 3 ], refDistance: 4, channel: 'near', rolloff: 1 } ], 'bobber cues use Tidewater spatial placement' );
	calls.length = 0;
	profile.rodLoop( 1.4, 1, 1 );
	assert.deepEqual( calls, [
		[ 'loop', 'world.tidewater:reel_wind', { targetLufs: - 36, weight: 1, rate: 1, channel: 'foreground', timeConstant: 0.08 } ],
		[ 'loop', 'world.tidewater:reel_drag', { targetLufs: - 29, weight: 1, rate: 0.95, channel: 'foreground', timeConstant: 0.06 } ],
		[ 'loop', 'world.tidewater:line_strain', { targetLufs: - 44, weight: 1, rate: 1.1, channel: 'foreground', timeConstant: 0.1 } ],
	], 'reel mixing stays in the Tidewater world profile');
	calls.length = 0;
	profile.stop();
	assert.ok( calls.every( ( [ type, , options ] ) => type === 'loop' && options.weight === 0 ), 'stopping fishing fades each reel loop without deactivating world ambience' );
	calls.length = 0;
	profile.deactivate();
	assert.deepEqual( calls.at( - 1 ), [ 'active-bank', '' ], 'leaving the Tidewater world releases its sample bank' );
} finally {
	Math.random = previousRandom;
}

console.log( 'Tidewater fishing audio profile uses generic engine sample playback' );
