import assert from 'node:assert/strict';
import { pierWalkableHeightAt } from '../../../src/world/PierSurface.js';
import { TIDEWATER_LAYOUT } from '../layout.js';

const terrainHeightAt = () => 0;
assert.equal( pierWalkableHeightAt( 40, - 70, terrainHeightAt, TIDEWATER_LAYOUT ), 0, 'outside pier remains terrain height' );
assert.equal( pierWalkableHeightAt( 55, 0, terrainHeightAt, TIDEWATER_LAYOUT ), 2.3, 'pier walkway uses deck height' );
assert.equal( pierWalkableHeightAt( 60, 36, terrainHeightAt, TIDEWATER_LAYOUT ), 2.3, 'pier head uses deck height' );
assert( pierWalkableHeightAt( 55, - 64.5, terrainHeightAt, TIDEWATER_LAYOUT ) > 0, 'landward steps raise the walkable surface' );
console.log( 'pier surface passed (terrain, steps, walkway and head)' );
