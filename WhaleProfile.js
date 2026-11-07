// Tidewater's authored humpback route and surfacing schedule.
export const TIDEWATER_WHALE_PROFILE = Object.freeze( {
	seed: 1,
	route: Object.freeze( [ [ 70, 300 ], [ 60, 200 ], [ 35, 120 ], [ 5, 88 ], [ - 25, 100 ], [ - 52, 128 ], [ - 75, 178 ], [ - 52, 262 ], [ - 10, 330 ] ].map( point => Object.freeze( point ) ) ),
	surfaceAt: 0.25,
	cruiseSpeed: 2.6,
	surfaceSpeed: 1.5,
} );
