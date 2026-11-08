// Shared deterministic market-prop placements for the WebGPU and WebGL render fixtures.
export function fishPropsRenderRecords( presentation ) {

	// Fish models face +z; yaw them 90 degrees so the camera sees their full side profile.
	const side = [ 0, Math.SQRT1_2, 0, Math.SQRT1_2 ];
	const record = ( kind, species, x, z, L, flags = [ 0, 0, 0, 0 ], seed = 0.5 ) => ( {
		kind, species, x, y: 0.05, z, L, q: side,
		pattern: species ? presentation.SPECIES[ species ].pattern : 0, seed,
		curl: 0.04, sag: 0.025, jaw: 0.04, flags,
	} );
	return [
		// Same species in dry and wet states, plus distinct pattern families.
		record( 'whole', 'redSnapper', - 2.55, 0.45, 1.55, [ 0, 0.05, 0.9, 0 ], 0.12 ),
		record( 'whole', 'redSnapper', - 0.85, 0.45, 1.55, [ 0, 0.95, 0, 0 ], 0.83 ),
		record( 'whole', 'tuna', 0.85, 0.45, 1.8, [ 0, 0.8, 0.05, 0 ], 0.31 ),
		record( 'whole', 'mahi', 2.55, 0.45, 1.55, [ 0, 0.3, 0.2, 0 ], 0.67 ),
		record( 'split', 'grouper', - 2.35, - 1.75, 1.4, [ 0, 0.1, 0.8, 0 ], 0.46 ),
		record( 'split', 'yellowtail', - 0.7, - 1.75, 1.35, [ 0, 0.9, 0, 0 ], 0.24 ),
		record( 'head', 'tuna', 0.75, - 1.75, 1.15, [ 0, 0.2, 0.15, 0.8 ], 0.58 ),
		record( 'trunk', 'tuna', 1.7, - 1.75, 1.15, [ 0, 0.15, 0.45, 0.35 ], 0.91 ),
		record( 'lobster', null, 2.75, - 1.75, 0.8 ),
		record( 'ice', null, - 1.5, - 3.45, 0.9 ),
		record( 'leaf', null, 0, - 3.45, 1.0 ),
	];

}
