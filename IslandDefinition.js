// Renderer-independent authored layout for Tidewater's built-in world.
// World renderers adapt these plain values to their own math/runtime types.
export const ISLAND_DEFINITION = Object.freeze( {
	terrainSize: 2048,
	terrainRes: 2048,
	beach: Object.freeze( { xMin: - 150, xMax: 170 } ),
	pier: Object.freeze( { x: 55, zStart: - 64, zEnd: 40, deckHeight: 2.3, width: 2.6, headWidth: 14, headDepth: 7 } ),
	boatDock: Object.freeze( { position: Object.freeze( [ 64.5, 0, 36.5 ] ), heading: 0 } ),
	fishStand: Object.freeze( { x: 49.9, z: - 74.6, yaw: 1.45 } ),
	chandlery: Object.freeze( { x: 85.5, z: - 60.5, yaw: - 1.9 } ),
	village: Object.freeze( { center: Object.freeze( [ 40, 0, - 118 ] ), radius: 95 } ),
	reef: Object.freeze( { center: Object.freeze( [ - 78, 0, 58 ] ), radius: 58 } ),
	spawn: Object.freeze( { position: Object.freeze( [ 18, 0, - 60 ] ), yaw: Math.PI } ),
	start: Object.freeze( { position: Object.freeze( [ 53.6, 0, - 77 ] ), yaw: Math.PI } ),
	// Incoming swell direction (unit, travel direction).
	swellDir: Object.freeze( [ - 0.12, - 1 ] ),
	vegetation: Object.freeze( {
		bay: Object.freeze( { centerX: 10, halfWidth: 235, zMin: - 245, zMax: - 30 } ),
		protectedPaths: Object.freeze( [ Object.freeze( { points: Object.freeze( [ Object.freeze( [ 55, - 130 ] ), Object.freeze( [ 55, - 40 ] ) ] ) } ) ] ),
		fallbackPaths: Object.freeze( [ Object.freeze( { width: 1.8, points: Object.freeze( [ Object.freeze( [ 55, - 65 ] ), Object.freeze( [ 54.6, - 72 ] ), Object.freeze( [ 52.4, - 82 ] ), Object.freeze( [ 48.4, - 92 ] ), Object.freeze( [ 44.8, - 100.5 ] ), Object.freeze( [ 42.6, - 107.2 ] ) ] ) } ) ] ),
	} ),
} );
