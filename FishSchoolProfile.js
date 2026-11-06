// Tidewater's authored species behavior data for the generic ElseMesh fish-school simulation.
// Supported movement modes and the simulation remain engine-owned.
const base = {
	cruise: 1, max: 2.5, burst: 6, accel: 4, sep: 2, nbr: 5, wSep: 5, wAli: 1, wCoh: 0.8, wGoal: 1, flee: 3.5,
	depth: [ 0.1, 0.5 ], homeRadius: 6, amp: 0.08, freq: [ 1.6, 0.9 ], ceiling: - 0.7, minDepth: 1.2, band: [ 1.5, 20 ],
};

const definitions = {
	bait: { model: 'silverside', length: [ 0.06, 0.09 ], mode: 'bait', cruise: 1.8, max: 4, burst: 10, accel: 7, flee: 3, depth: [ 0.35, 0.75 ], amp: 0.1, freq: [ 3, 1.1 ] },
	silverside: { model: 'silverside', length: [ 0.06, 0.09 ], mode: 'school', cruise: 1.6, max: 3.5, burst: 9, accel: 6, sep: 1.8, nbr: 7, wSep: 7, wAli: 2.6, wCoh: 1.4, wGoal: 0.7, flee: 4.5, depth: [ 0.35, 0.8 ], homeRadius: 18, amp: 0.1, freq: [ 3, 1.1 ], band: [ 4, 20 ] },
	chromis: { model: 'chromis', length: [ 0.08, 0.11 ], mode: 'hover', cruise: 0.8, max: 2.5, burst: 7, accel: 5, sep: 2.2, nbr: 6, wAli: 0.5, wCoh: 0.5, flee: 3.0, depth: [ 0.12, 0.45 ], homeRadius: 3, freq: [ 2.5, 0.9 ], amp: 0.1, band: [ 4, 16 ] },
	grunt: { model: 'grunt', length: [ 0.16, 0.24 ], mode: 'mill', cruise: 0.45, max: 1.8, burst: 5, accel: 3, sep: 1.6, nbr: 4, wAli: 1.8, wCoh: 1.0, wGoal: 0.9, depth: [ 0.04, 0.2 ], homeRadius: 1.5, band: [ 2.5, 10 ] },
	yellowtail: { model: 'yellowtail', length: [ 0.25, 0.36 ], mode: 'school', cruise: 0.8, max: 2.2, burst: 5, accel: 3, sep: 1.8, wAli: 1.6, wGoal: 0.7, flee: 5, depth: [ 0.15, 0.5 ], homeRadius: 16, freq: [ 1.5, 0.9 ], band: [ 3, 14 ] },
	tang: { model: 'tang', length: [ 0.15, 0.24 ], mode: 'forage', cruise: 0.7, max: 2, burst: 5, accel: 3, sep: 1.8, wAli: 1.0, wCoh: 0.7, wGoal: 0.9, flee: 4, depth: [ 0.03, 0.2 ], homeRadius: 14, amp: 0.07, band: [ 2, 9 ] },
	sergeant: { model: 'sergeant', length: [ 0.12, 0.17 ], mode: 'hover', cruise: 0.6, max: 2, burst: 6, accel: 4, wAli: 0.6, wCoh: 0.6, flee: 3.2, depth: [ 0.08, 0.3 ], homeRadius: 2, amp: 0.09, freq: [ 2, 0.9 ], band: [ 1.5, 6 ] },
	wrasse: { model: 'wrasse', length: [ 0.07, 0.12 ], mode: 'forage', cruise: 1.3, max: 3, burst: 7, accel: 6, wAli: 0.5, wCoh: 0.6, wGoal: 1.2, flee: 2.5, depth: [ 0.02, 0.1 ], homeRadius: 5, amp: 0.1, freq: [ 2.5, 1.0 ], band: [ 1.5, 9 ] },
	parrot: { model: 'parrot', length: [ 0.3, 0.45 ], mode: 'forage', cruise: 0.55, max: 1.6, burst: 4, accel: 2, sep: 2.2, nbr: 6, wSep: 4, wAli: 0.6, wCoh: 0.5, flee: 4.5, depth: [ 0.02, 0.1 ], homeRadius: 18, amp: 0.05, freq: [ 1.0, 0.6 ], band: [ 2, 12 ] },
	angel: { model: 'angel', length: [ 0.25, 0.35 ], mode: 'pair', cruise: 0.45, max: 1.4, burst: 3.5, accel: 2, sep: 1.5, nbr: 4, wSep: 3, wAli: 0.8, wCoh: 1.2, depth: [ 0.04, 0.15 ], homeRadius: 3, amp: 0.05, freq: [ 1.0, 0.6 ], band: [ 5, 16 ] },
	grouper: { model: 'grouper', length: [ 0.6, 0.85 ], mode: 'lurk', cruise: 0.15, max: 1.2, burst: 3, accel: 1.5, sep: 1, nbr: 2, wSep: 1, wAli: 0, wCoh: 0, wGoal: 0.8, flee: 3, depth: [ 0.0, 0.05 ], homeRadius: 2.5, amp: 0.04, freq: [ 0.6, 0.6 ], band: [ 5, 16 ] },
	barracuda: { model: 'barracuda', length: [ 1.0, 1.35 ], mode: 'solo', cruise: 0.15, max: 1.2, burst: 3, accel: 1.2, sep: 1, nbr: 2, wSep: 1, wAli: 0, wCoh: 0, wGoal: 0.6, depth: [ 0.3, 0.6 ], homeRadius: 10, amp: 0.035, freq: [ 0.5, 0.8 ], band: [ 4, 16 ] },
	jack: { model: 'jack', length: [ 0.4, 0.6 ], mode: 'patrol', cruise: 1.1, max: 2.6, burst: 5, accel: 3, sep: 2, nbr: 5, wAli: 1.4, wCoh: 0.9, wGoal: 0.9, flee: 4, depth: [ 0.25, 0.6 ], homeRadius: 20, amp: 0.07, freq: [ 1.6, 0.8 ], band: [ 6, 20 ] },
	eagleRay: { model: 'eagleRay', length: [ 1.6, 2.0 ], mode: 'cruise', cruise: 0.35, max: 0.9, burst: 1.8, accel: 0.8, sep: 1, nbr: 2, wSep: 1, wAli: 0, wCoh: 0, wGoal: 0.8, flee: 5, depth: [ 0.25, 0.55 ], homeRadius: 30, amp: 0.13, freq: [ 0.45, 0.2 ], band: [ 6, 20 ] },
	stingray: { model: 'stingray', length: [ 0.9, 1.3 ], mode: 'glide', cruise: 0.3, max: 0.8, burst: 1.6, accel: 0.8, sep: 1, nbr: 2, wSep: 1, wAli: 0, wCoh: 0, wGoal: 0.8, flee: 3.5, depth: [ 0, 0 ], homeRadius: 14, amp: 0.05, freq: [ 0.9, 0.5 ], band: [ 2.5, 16 ] },
	turtle: { model: 'turtle', length: [ 0.9, 1.1 ], mode: 'turtle', cruise: 0.3, max: 0.8, burst: 1.4, accel: 0.6, sep: 1, nbr: 2, wSep: 1, wAli:  0, wCoh: 0, wGoal: 0.7, flee: 4, depth: [ 0.15, 0.6 ], homeRadius: 25, amp: 0, freq: [ 0.3, 0.25 ], ceiling: - 0.25, band: [ 3, 12 ] },
	tarpon: { model: 'tarpon', length: [ 1.3, 1.8 ], mode: 'cruise', cruise: 0.3, max: 1.2, burst: 3, accel: 1, sep: 1.5, nbr: 3, wSep: 2, wAli: 0.8, wCoh: 0.5, wGoal: 0.7, flee: 5, depth: [ 0.3, 0.7 ], homeRadius: 25, amp: 0.04, freq: [ 0.5, 0.7 ], band: [ 4, 14 ] },
	needlefish: { model: 'needlefish', length: [ 0.5, 0.8 ], mode: 'surface', cruise: 0.9, max: 2.5, burst: 6, accel: 3, sep: 3, nbr: 4, wSep: 3, wAli: 1, wCoh: 0.5, wGoal: 0.9, flee: 4, homeRadius: 25, amp: 0.05, freq: [ 1.2, 0.7 ], ceiling: - 0.12, minDepth: 1.0, band: [ 1.8, 12 ] },
	mullet: { model: 'mullet', length: [ 0.3, 0.4 ], mode: 'jumper', cruise: 0.8, max: 2.2, burst: 5, accel: 3, sep: 1.8, nbr: 5, wAli: 1.5, wCoh: 1, wGoal: 0.8, flee: 4, depth: [ 0.3, 0.9 ], homeRadius: 14, amp: 0.07, freq: [ 1.5, 0.9 ], ceiling: - 0.25, minDepth: 1.2, band: [ 1.8, 4.5 ] },
	fry: { model: 'silverside', length: [ 0.045, 0.065 ], mode: 'fry', cruise: 2, max: 4, burst: 14, accel: 9, sep: 1.6, nbr: 8, wSep: 7, wAli: 2.4, wCoh: 1.6, wGoal: 0.9, flee: 3.2, depth: [ 0.3, 0.8 ], homeRadius: 6, amp: 0.11, freq: [ 3.5, 1.2 ], ceiling: - 0.2, minDepth: 0.5, band: [ 0.5, 3.5 ] },
	pierGrunt: { model: 'grunt', length: [ 0.16, 0.26 ], mode: 'pile', cruise: 0.45, max: 1.8, burst: 5, accel: 3, sep: 1.6, nbr: 4, wAli: 1.4, wCoh: 0.9, depth: [ 0.1, 0.5 ], homeRadius: 1.6, band: [ 2, 6 ] },
	pierSnapper: { model: 'yellowtail', length: [ 0.25, 0.34 ], mode: 'pile', cruise: 0.6, max: 2.2, burst: 5, accel: 3, sep: 1.8, wAli: 1.4, wCoh: 0.8, flee: 4.5, depth: [ 0.3, 0.8 ], homeRadius: 2.5, freq: [ 1.5, 0.9 ], band: [ 2, 6 ] },
	pilot: { model: 'jack', length: [ 0.25, 0.4 ], mode: 'escort', cruise: 1.2, max: 3.5, burst: 7, accel: 5, flee: 2, amp: 0.07, freq: [ 1.8, 0.9 ], ceiling: - 0.3, minDepth: 2, band: [ 0, 1e9 ] },
	juvenile: { model: 'jack', length: [ 0.1, 0.16 ], mode: 'escort', cruise: 1.5, max: 4, burst: 9, accel: 7, flee: 1.5, amp: 0.1, freq: [ 2.5, 1 ], ceiling: - 0.3, minDepth: 2, band: [ 0, 1e9 ] },
	remora: { model: 'mullet', length: [ 0.35, 0.55 ], mode: 'remora', cruise: 0.5, max: 3, burst: 3, accel: 3, flee: 0, amp: 0.03, freq: [ 0.8, 0.3 ], ceiling: 5, minDepth: 0, band: [ 0, 1e9 ] },
	pierSergeant: { model: 'sergeant', length: [ 0.12, 0.17 ], mode: 'pile', cruise: 0.6, max: 2, burst: 6, accel: 4, wAli: 0.6, wCoh: 0.6, flee: 3.2, depth: [ 0.3, 0.9 ], homeRadius: 1.2, amp: 0.09, freq: [ 2, 0.9 ], band: [ 2, 6 ] },
};

export const SCHOOL_BEHAVIOUR = Object.freeze( Object.fromEntries(
	Object.entries( definitions ).map( ( [ name, values ] ) => [ name, Object.freeze( { name, ...base, ...values } ) ] )
) );
