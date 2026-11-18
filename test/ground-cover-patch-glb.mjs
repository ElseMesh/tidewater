import assert from 'node:assert/strict';
import { parseGLB } from '../../../src/engine/loaders/GLTF.js';
import { buildGroundCoverPatch } from '../vegetation/GroundCoverPatch.js';
import { groundCoverPatchGLB } from '../vegetation/GroundCoverPatchGLB.js';

for ( const [ level, name ] of [ 'near', 'mid', 'far' ].entries() ) {
	const authored = buildGroundCoverPatch( level, 7 );
	const bytes = groundCoverPatchGLB( `Tidewater ${name} ground cover`, authored );
	assert.deepEqual( groundCoverPatchGLB( `Tidewater ${name} ground cover`, authored ), bytes, `${name} patch export is byte deterministic` );
	const primitive = parseGLB( bytes ).meshes[ 0 ][ 0 ];
	assert.deepEqual( primitive.attributes.POSITION.array, authored.positions, `${name} GLB preserves authored positions` );
	assert.deepEqual( primitive.attributes.NORMAL.array, authored.normals, `${name} GLB preserves authored normals` );
	assert.deepEqual( primitive.attributes._ELSEMESH_VDATA.array, authored.sides, `${name} GLB preserves blade-side data` );
	assert.deepEqual( primitive.attributes._ELSEMESH_VDATA1.array, authored.slots, `${name} GLB preserves the authored cell-slot stream` );
	assert.deepEqual( primitive.attributes._ELSEMESH_VDATA2.array, authored.bladeData, `${name} GLB preserves category, height, and LOD-tier data` );
	assert.deepEqual( primitive.indices, authored.indices, `${name} GLB preserves indexed topology` );
	assert.equal( primitive.indices.length / 3, authored.triangles, `${name} GLB preserves the authored triangle count` );
}

console.log( 'Tidewater ground-cover GLBs preserve the authored near/mid/far geometry streams' );
