import FISHING_BANK from '../tools/audio/fishing-bank.json' with { type: 'json' };
import AMBIENT_BANK from '../audio/ambient-bank.json' with { type: 'json' };

const clamp = ( value, min, max ) => Math.max( min, Math.min( max, value ) );
const smooth = ( min, max, value ) => {
	const t = clamp( ( value - min ) / ( max - min ), 0, 1 );
	return t * t * ( 3 - 2 * t );
};

const FISHING_SAMPLES = Object.freeze( Object.keys( FISHING_BANK ).filter( name => name !== 'coins' ) );
const TIDEWATER_SOUND_BANK = Object.freeze( { ...AMBIENT_BANK, ...FISHING_BANK } );

// Tidewater owns its fishing cue selection, levels, pitch variation, and reel
// response. ElseMesh supplies only sample playback and spatial audio controls.
export class TidewaterFishingAudio {
	constructor( soundscape ) {
		this.soundscape = soundscape;
		this.samples = soundscape?.registerSampleBank?.( 'world.tidewater', TIDEWATER_SOUND_BANK ) || null;
	}

	activate() {
		this.soundscape?.setActiveSampleBank?.( 'world.tidewater' );
	}

	rodReady() {
		this.soundscape?.preloadSamples?.( FISHING_SAMPLES.map( name => this.#sample( name ) ) );
	}

	whoosh( power = 1 ) {
		const p = clamp( Number.isFinite( power ) ? power : 1, 0, 1 );
		this.#play( 'rod_swish', - 30 - ( 1 - p ) * 9, 0.9 + p * 0.2 + Math.random() * 0.06, 'rod', 4, null, null, 'foreground' );
	}

	bail( open ) {
		this.#play( 'bail_click', - 40 + ( open ? 0 : 2 ), open ? 1.08 + Math.random() * 0.06 : 0.92 + Math.random() * 0.06, 'rod', 4, null, null, 'foreground' );
	}

	lineOut( power = 1 ) {
		const p = clamp( Number.isFinite( power ) ? power : 1, 0, 1 );
		this.#play( 'line_out', - 38 - ( 1 - p ) * 6, 1.25 - p * 0.35, 'rod', 4, null, null, 'foreground' );
	}

	plop( position ) {
		if ( ! position ) return;
		this.#play( 'plop', - 30, 0.95 + Math.random() * 0.15, 'fish', 3, position, 4 );
	}

	fishSplash( position, strength = 0.5 ) {
		if ( ! position ) return;
		const s = clamp( Number.isFinite( strength ) ? strength : 0.5, 0, 1 );
		this.#play( 'fish_splash', - 24 - ( 1 - s ) * 10, 0.9 + Math.random() * 0.2 + ( 1 - s ) * 0.15, 'fish', 3, position, 6 );
	}

	fishFlop() {
		this.#play( 'fish_flop', - 32, 0.9 + Math.random() * 0.2, 'rod', 4 );
	}

	lineSnap() {
		this.#play( 'line_snap', - 24, 0.95 + Math.random() * 0.1, 'rod', 4, null, null, 'rod' );
	}

	coin() {
		this.#play( 'coins', - 30, 0.97 + Math.random() * 0.06, 'coin', 1 );
	}

	rodLoop( crankRate, dragSpeed, tension ) {
		const crank = clamp( Number.isFinite( crankRate ) ? crankRate : 0, 0, 3 );
		const dragValue = clamp( Number.isFinite( dragSpeed ) ? dragSpeed : 0, 0, 5 );
		const strainValue = clamp( Number.isFinite( tension ) ? tension : 0, 0, 2 );
		const wind = smooth( 0.05, 0.35, crank );
		const drag = smooth( 0.05, 0.7, dragValue );
		const strain = smooth( 0.7, 1.0, strainValue );
		this.soundscape?.setSampleLoop?.( this.#sample( 'reel_wind' ), { targetLufs: - 36, weight: wind * ( 0.8 + 0.2 * Math.min( 1, crank ) ), rate: clamp( crank / 1.4, 0.45, 1.3 ), channel: 'foreground', timeConstant: 0.08 } );
		this.soundscape?.setSampleLoop?.( this.#sample( 'reel_drag' ), { targetLufs: - 29, weight: drag, rate: clamp( 0.7 + dragValue * 0.25, 0.7, 1.25 ), channel: 'foreground', timeConstant: 0.06 } );
		this.soundscape?.setSampleLoop?.( this.#sample( 'line_strain' ), { targetLufs: - 44, weight: strain, rate: 0.9 + 0.2 * strain, channel: 'foreground', timeConstant: 0.1 } );
	}

	stop() {
		this.rodLoop( 0, 0, 0 );
	}

	deactivate() {
		this.stop();
		this.soundscape?.setActiveSampleBank?.( '' );
	}

	#play( name, targetLufs, rate, category, maxVoices, position = null, refDistance = 1, channel = 'near' ) {
		this.soundscape?.playSample?.( this.#sample( name ), { targetLufs, rate, category, maxVoices, position: position ? [ position.x, position.y, position.z ] : null, refDistance: Number.isFinite( refDistance ) ? refDistance : 1, channel, rolloff: 1 } );
	}

	#sample( name ) {
		return this.samples?.[ name ] || name;
	}
}
