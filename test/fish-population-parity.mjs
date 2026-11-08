import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Vector3 } from '../../../src/engine/index.js';
import { FishSchools } from '../fish/FishSchools.js';
import { mulberry32 } from '../../../src/util/Noise.js';
import * as presentation from '../FishPresentation.js';
import { FISH_SCHOOL_POPULATION } from '../FishSchoolPopulation.js';
import { TIDEWATER_LAYOUT } from '../layout.js';

assert.equal( presentation.SCHOOLS.barracuda.flee, 3.5, 'Barracuda retains the pre-split shared flee distance; it did not override the 3.5 m default' );
const canonical = value => Array.isArray( value ) ? value.map( canonical ) : value && typeof value === 'object' ? Object.fromEntries( Object.keys( value ).sort().map( key => [ key, canonical( value[ key ] ) ] ) ) : value;
assert.equal( createHash( 'sha256' ).update( JSON.stringify( canonical( presentation.SCHOOLS ) ) ).digest( 'hex' ), 'c69c8174ea818bc8ffa660413d0e57024046b58decd010dab6d5297d1db2936e', 'all 26 effective species profiles retain the pre-extraction Fish.js values from c32a293d' );

const sim = Object.create( FishSchools.prototype );
Object.assign( sim, {
	center: new Vector3( 2, 0, - 4 ),
	radius: 90,
	anchors: [ [ 1, 2 ], [ - 3, 8 ], [ 12, - 6 ] ],
	worldLayout: TIDEWATER_LAYOUT,
	presentation,
	population: FISH_SCHOOL_POPULATION,
	rng: mulberry32( 23 ),
	groups: [],
	n: 0,
	depthAt: () => 11,
	fits: () => true,
} );

sim.layout( true );
const state = sim.groups.map( group => ( {
	name: group.sp.name,
	count: group.count,
	offset: group.offset,
	zone: group.zone,
	home: [ group.home.x, group.home.y, group.home.z ],
} ) );
const snapshot = JSON.stringify( { groups: state, n: sim.n, bait: sim.baitGroups?.map( group => group.sp.name ), dropPath: sim.dropPath, escort: sim.escort?.map( group => group.sp.name ) } );
assert.equal( sim.groups.length, 63, 'the authored recipe retains all 63 group placements' );
assert.equal( sim.n, 2066, 'the authored recipe retains the same total number of fish' );
assert.equal( createHash( 'sha256' ).update( snapshot ).digest( 'hex' ), 'e9100863d4484a3e1a90bec5cfb678ac0b1ef4db00ab634beffecba72f7df4e4', 'group order, seeded homes, zones, and escort/drop-off data match the pre-extraction recipe' );

console.log( 'Tidewater fish population parity: ok' );
