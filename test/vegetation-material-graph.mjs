import assert from 'node:assert/strict';
import { compileWorldMaterialGraph } from '../../../src/materials/WorldMaterialGraphCompiler.js';
import { validateWorldMaterialGraph } from '../../../src/network/WorldMaterialGraph.js';
import { TIDEWATER_PALM_MATERIAL_GRAPH } from '../vegetation/VegetationMaterialGraph.js';

assert.equal( validateWorldMaterialGraph( TIDEWATER_PALM_MATERIAL_GRAPH ), TIDEWATER_PALM_MATERIAL_GRAPH, 'the authored palm material graph satisfies the bounded renderer-neutral contract' );
const webgpu = compileWorldMaterialGraph( TIDEWATER_PALM_MATERIAL_GRAPH, 'webgpu', { doubleSided: true } );
const webgl = compileWorldMaterialGraph( TIDEWATER_PALM_MATERIAL_GRAPH, 'webgl', { doubleSided: true } );
for ( const [ name, compiled ] of [ [ 'WebGPU', webgpu ], [ 'WebGL', webgl ] ] ) {
	assert.ok( compiled.inputs.includes( 'vdata1' ), `${name} binds the authored vegetation part and age stream` );
	assert.ok( compiled.inputs.includes( 'instanceMaterial1' ), `${name} binds the authored palm height and seed` );
	assert.ok( compiled.inputs.includes( 'frontFacing' ), `${name} supports the authored underside tint` );
}
assert.match( webgpu.surface, /s\.thinTransmission =/ );
assert.match( webgl.glsl.thinTransmission, /emgThinTransmission =/ );
assert.equal( TIDEWATER_PALM_MATERIAL_GRAPH.nodes.length <= 1024, true, 'palm material remains inside the signed graph node limit' );

console.log( 'Tidewater renderer-neutral palm material graph: ok' );
