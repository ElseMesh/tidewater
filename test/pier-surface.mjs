import assert from 'node:assert/strict';
import { Colliders } from '../../../src/world/Colliders.js';
import { installPierGameplayColliders } from '../PierColliders.js';
import { pierWalkableHeightAt } from '../PierSurface.js';
import { TIDEWATER_LAYOUT } from '../layout.js';

const terrainHeightAt = () => 0;
assert.equal( pierWalkableHeightAt( 40, - 70, terrainHeightAt, TIDEWATER_LAYOUT ), 0, 'outside pier remains terrain height' );
assert.equal( pierWalkableHeightAt( 55, 0, terrainHeightAt, TIDEWATER_LAYOUT ), 2.3, 'pier walkway uses deck height' );
assert.equal( pierWalkableHeightAt( 60, 36, terrainHeightAt, TIDEWATER_LAYOUT ), 2.3, 'pier head uses deck height' );
assert( pierWalkableHeightAt( 55, - 64.5, terrainHeightAt, TIDEWATER_LAYOUT ) > 0, 'landward steps raise the walkable surface' );

const colliders = new Colliders();
installPierGameplayColliders( { colliders, terrain: { heightAt: terrainHeightAt }, worldLayout: TIDEWATER_LAYOUT } );
const steps = colliders.boxes.filter( box => box.tag === 'pierStep' );
const deck = colliders.boxes.filter( box => box.tag === 'pierDeck' );
const ladder = colliders.boxes.filter( box => box.tag === 'ladder' );
const rails = colliders.boxes.filter( box => box.tag === 'pierRail' );
assert.equal( steps.length, 10, 'WebGL built-in keeps the complete stair collision ramp' );
assert.equal( deck.length, 2, 'WebGL built-in keeps the walkway and T-head walkable' );
assert( deck.every( box => box.walkable && box.solid ), 'pier deck collision is walkable and blocks movement' );
assert.equal( colliders.groundHeightAt( 55, 0, 3 ), 2.3, 'the WebGL built-in player stands on the dock deck' );
assert.equal( ladder.length, 9, 'the ladder contains the authored rung sequence' );
assert( ladder.every( box => box.walkable && ! box.solid ), 'ladder rungs are walkable without blocking swimming' );
assert.equal( rails.length, 5, 'the pier has five rail segments around the ladder opening' );
assert( rails.every( box => box.solid && ! box.walkable ), 'pier rails block movement without becoming floor' );
console.log( 'Tidewater pier surface and built-in colliders passed' );
