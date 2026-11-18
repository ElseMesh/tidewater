// Renderer-neutral authored distance bands for Tidewater's finite vegetation.
// The geometry and backend adapters consume these values; they do not choose
// different world-specific thresholds.
export const PALM_LOD = Object.freeze( {
	nearDistance: 120,
	fadeStart: 112.8,
	fadeEnd: 127.2,
	shadowMaxDistance: 120,
} );

export const CANOPY_FAR_FADE = Object.freeze( [ 2600, 2800 ] );

