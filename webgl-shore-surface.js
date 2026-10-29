import { SHORE_DEFAULT_AMPLITUDE, SHORE_DEFAULT_PERIOD, SHORE_DEFAULT_VARIATION, shoreWaveAmplitude, shoreWobble, sampleShoreField } from '../../src/ocean/ShoreSwash.js';

const clamp = ( x, a, b ) => Math.max( a, Math.min( b, x ) );
const smoothstep = ( a, b, x ) => {
	const t = clamp( ( x - a ) / ( b - a ), 0, 1 );
	return t * t * ( 3 - 2 * t );
};

// Tidewater's CPU water query uses the same depth-aware crest as its WebGL
// water shader. The generic fallback receives this as an optional world hook.
export function createWebGLShoreSurfaceOffset( { terrain, seaLevel, field } ) {
	if ( ! terrain || ! field ) return null;
	const sample = new Float32Array( 4 );

	return ( x, z, time ) => {
		const depth = seaLevel - terrain.heightAt( x, z );
		if ( depth <= - 0.25 || depth >= 26 ) return 0;
		const sh = sampleShoreField( field, x, z, sample );
		const exposure = Math.hypot( sh[ 1 ], sh[ 2 ] );
		const env = smoothstep( 26, 13, depth ) * smoothstep( - 0.25, 0.05, depth ) * smoothstep( 0.02, 0.3, exposure );
		if ( env <= 0 ) return 0;
		const dirX = sh[ 1 ] / Math.max( exposure, 1e-4 ), dirZ = sh[ 2 ] / Math.max( exposure, 1e-4 );
		const along = - dirZ * x + dirX * z;
		const phase = ( time - sh[ 0 ] ) / SHORE_DEFAULT_PERIOD + shoreWobble( along );
		const wave = Math.floor( phase + 0.5 ), u = phase - wave;
		const amplitude = shoreWaveAmplitude( wave, along, { amplitude: SHORE_DEFAULT_AMPLITUDE, variation: SHORE_DEFAULT_VARIATION } );
		const lambda = Math.sqrt( clamp( depth, 0.3, 25 ) * 9.81 ) * 9;
		const crestDepth = seaLevel - terrain.heightAt( x + dirX * u * lambda, z + dirZ * u * lambda );
		const breakDepth = Math.pow( amplitude * 3.556 / 0.78, 0.8 );
		const breaking = ( breakDepth - crestDepth ) / Math.max( breakDepth * 0.13, 0.05 );
		const shoaled = amplitude * Math.pow( 10 / clamp( depth, 0.35, 10 ), 0.25 );
		const sharpness = 1 + 2 * smoothstep( - 2.5, 0, breaking );
		const meanProfile = 1 / Math.sqrt( ( sharpness + 0.25 ) * Math.PI );
		const skew = smoothstep( - 3, 0, breaking ) * 0.55;
		const phaseSkew = u - skew * ( 1 - Math.cos( u * 2 * Math.PI ) ) / ( 2 * Math.PI );
		const skewCrest = Math.max( ( Math.cos( phaseSkew * 2 * Math.PI ) + 1 ) * 0.5, 0 );
		const curl = smoothstep( - 3, 0, breaking );
		const preHeight = shoaled * 2 * ( Math.pow( skewCrest, sharpness ) - meanProfile ) * ( 1 + smoothstep( - 1, 0.3, breaking ) * 0.22 );
		const bore = smoothstep( 0.85, 1.35, breaking );
		const waveHeight = shoaled * 2 * ( 1 - meanProfile );
		const lipHeight = Math.min( waveHeight * 0.6, Math.max( depth, 0 ) * 0.75 ) * ( smoothstep( 0, 0.3, depth ) * 0.7 + 0.3 );
		const lip = smoothstep( - 0.17, - 0.12, u ) * ( 1 - smoothstep( - 0.025, 0.015, u ) );
		return ( preHeight + lipHeight * bore * curl * lip ) * env;
	};
}
