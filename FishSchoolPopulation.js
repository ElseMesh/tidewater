// Authored Tidewater fish population and placement zones. The engine resolves these
// renderer-neutral descriptors through its generic fish-school placement API.
const reef = Object.freeze( { kind: 'reef', radiusScale: 0.75 } );
const dropOff = Object.freeze( { kind: 'drop-off', radius: 30 } );
const bay = Object.freeze( { kind: 'circle', center: [ 45, 70 ], radius: 45 } );

export const FISH_SCHOOL_POPULATION = Object.freeze( {
	groups: Object.freeze( [
		{ school: 'sergeant', counts: [ 14, 12, 10, 12 ], zone: reef, anchored: true },
		{ school: 'chromis', counts: [ 26, 22, 20, 24, 18, 22 ], zone: reef, anchored: true },
		{ school: 'grunt', counts: [ 28, 22, 20, 16, 16 ], zone: reef, anchored: true },
		{ school: 'yellowtail', counts: [ 16, 12 ], zone: reef },
		{ school: 'tang', counts: [ 18, 12 ], zone: reef },
		{ school: 'wrasse', counts: [ 16, 12, 12, 14 ], zone: reef },
		{ school: 'parrot', counts: [ 4, 3, 3, 3 ], zone: reef },
		{ school: 'angel', counts: [ 2, 2, 2 ], zone: reef, anchored: true },
		{ school: 'grouper', counts: [ 1, 1 ], zone: reef, anchored: true },
		{ school: 'barracuda', counts: [ 1, 1 ], zone: reef },
		{ school: 'silverside', counts: [ 150, 120 ], zone: reef },
		{ school: 'bait', counts: [ 900 ], zone: { kind: 'drop-off', radius: 14 }, collect: 'baitGroups' },
		{ school: 'jack', counts: [ 9, 6 ], zone: dropOff },
		{ school: 'eagleRay', counts: [ 1 ], zone: dropOff },
		{ school: 'stingray', counts: [ 1, 1 ], zone: { kind: 'reef', radiusScale: 1, band: [ 3, 12 ], sand: true } },
		{ school: 'turtle', counts: [ 1 ], zone: { kind: 'reef', radiusScale: 1, band: [ 3, 10 ] } },
	] ),
	bayGroups: Object.freeze( [
		{ school: 'tarpon', counts: [ 3 ], zone: { ...bay, band: [ 5, 14 ] } },
		{ school: 'jack', counts: [ 5 ], zone: { kind: 'pier-end', offset: [ 0, 0 ], radius: 20, band: [ 3, 10 ] } },
		{ school: 'stingray', counts: [ 1 ], zone: { ...bay, band: [ 3, 9 ], sand: true } },
		{ school: 'barracuda', counts: [ 1 ], zone: { kind: 'pier-end', offset: [ 6, - 4 ], radius: 8, band: [ 3, 8 ] } },
		{ school: 'needlefish', counts: [ 3, 2, 1 ], zone: { kind: 'circle', center: [ 30, 30 ], radius: 60, band: [ 2, 12 ] } },
		{ school: 'mullet', counts: [ 9, 7 ], zone: { kind: 'circle', center: [ 20, 5 ], radius: 70 } },
		{ school: 'fry', counts: [ 90, 70, 80, 60, 70 ], zones: [
			{ kind: 'circle', center: [ - 60, 0 ], radius: 30 },
			{ kind: 'circle', center: [ - 10, 0 ], radius: 30 },
			{ kind: 'circle', center: [ 30, 0 ], radius: 30 },
			{ kind: 'circle', center: [ 110, 0 ], radius: 30 },
			{ kind: 'circle', center: [ 150, 0 ], radius: 30 },
		] },
		{ school: 'pilot', counts: [ 12 ], zone: { kind: 'point', center: [ 0, 200 ], radius: 5, band: [ 0, 1e9 ] }, direct: true, collect: 'escort' },
		{ school: 'juvenile', counts: [ 6 ], zone: { kind: 'point', center: [ 0, 200 ], radius: 5, band: [ 0, 1e9 ] }, direct: true, collect: 'escort' },
		{ school: 'remora', counts: [ 4 ], zone: { kind: 'point', center: [ 0, 200 ], radius: 5, band: [ 0, 1e9 ] }, direct: true, collect: 'escort' },
		{ school: 'pierGrunt', counts: [ 14 ], zone: { kind: 'pier-piles', radius: 18, walkStart: 1.5, walkSpacing: 3, sideOffset: 0.17, headInset: 0.3, headColumns: 5, edgeInset: 0.25, minDepth: 2.2, homeRadius: 5 }, anchored: true, pilesNearHome: true },
		{ school: 'pierSnapper', counts: [ 10 ], zone: { kind: 'pier-piles', radius: 18, walkStart: 1.5, walkSpacing: 3, sideOffset: 0.17, headInset: 0.3, headColumns: 5, edgeInset: 0.25, minDepth: 2.2, homeRadius: 5 }, anchored: true, pilesNearHome: true },
		{ school: 'pierSergeant', counts: [ 12 ], zone: { kind: 'pier-piles', radius: 18, walkStart: 1.5, walkSpacing: 3, sideOffset: 0.17, headInset: 0.3, headColumns: 5, edgeInset: 0.25, minDepth: 2.2, homeRadius: 5 }, anchored: true, pilesNearHome: true },
	] ),
} );
