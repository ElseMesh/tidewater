import assert from 'node:assert/strict';
import { BLADE_TIER, CELL, CLUMPS, OATS, VINES, buildGroundCoverPatch } from '../vegetation/GroundCoverPatch.js';

assert.equal( CELL, 8, 'Tidewater authors ground cover in the source 8 m cells' );
assert.equal( CLUMPS, 384, 'each cell uses the source 384 meadow/dune clump slots' );
assert.equal( OATS, 12, 'near and mid patches use the source 12 oat slots' );
assert.equal( VINES, 28, 'near patches use the source 28 creeper slots' );
assert.deepEqual( BLADE_TIER, [ 0, 0, 1, 1, 2, 2, 2 ], 'the authored seven-blade tier assignment is stable' );

const levels = [ 0, 1, 2 ].map( level => buildGroundCoverPatch( level ) );
const categorySet = patch => new Set( Array.from( patch.bladeData ).filter( ( _value, index ) => index % 4 === 1 ) );
const slotSet = ( patch, tier ) => {
	const slots = new Set();
	for ( let vertex = 0; vertex < patch.slots.length / 4; vertex ++ ) {
		const offset = vertex * 4;
		if ( patch.slots[ offset + 3 ] === tier ) slots.add( `${patch.slots[offset]},${patch.slots[offset + 1]}` );
	}
	return slots;
};

assert.deepEqual( [ ...categorySet( levels[ 0 ] ) ].sort(), [ 0, 1, 2, 3, 4 ], 'near source patch contains grass, oat stalks/heads, creeper leaves, and flowers' );
assert.deepEqual( [ ...categorySet( levels[ 1 ] ) ].sort(), [ 0, 1, 2 ], 'mid source LOD keeps grass and oat geometry while authored creeper fades out' );
assert.deepEqual( [ ...categorySet( levels[ 2 ] ) ].sort(), [ 0 ], 'far source LOD is the authored grass-only transition to terrain meadow shading' );
for ( const patch of levels ) {
	const vertexCount = patch.positions.length / 3;
	assert.equal( patch.normals.length, vertexCount * 3, 'positions and normals share one vertex layout' );
	assert.equal( patch.sides.length, vertexCount * 4, 'the side stream is one VEC4 per vertex' );
	assert.equal( patch.slots.length, vertexCount * 4, 'the cell-slot stream is one VEC4 per vertex' );
	assert.equal( patch.bladeData.length, vertexCount * 4, 'the blade-data stream is one VEC4 per vertex' );
	assert.ok( patch.indices.length > 0 && patch.triangles === patch.indices.length / 3, 'the portable patch has indexed triangles' );
	assert.deepEqual( buildGroundCoverPatch( levels.indexOf( patch ) ), patch, 'patch export is deterministic for the authored seed' );
	assert.equal( slotSet( patch, 0 ).size, CLUMPS, 'every LOD retains the same authored grass-clump arrangement' );
}
assert.equal( slotSet( levels[ 0 ], 1 ).size, OATS, 'near patch retains all authored oat positions' );
assert.equal( slotSet( levels[ 1 ], 1 ).size, OATS, 'mid patch retains the same authored oat positions' );
assert.equal( slotSet( levels[ 0 ], 2 ).size, VINES, 'near patch retains all authored creeper positions' );
assert.ok( levels[ 0 ].triangles > levels[ 1 ].triangles && levels[ 1 ].triangles > levels[ 2 ].triangles, 'the three source LODs reduce topology progressively' );

console.log( 'Tidewater ground-cover authoring recipe preserves source slots, categories, and LOD geometry' );
