import assert from 'node:assert/strict';
import { compileWorldMaterialGraph } from '../../../src/materials/WorldMaterialGraphCompiler.js';
import { validateWorldMaterialGraph } from '../../../src/network/WorldMaterialGraph.js';
import { TIDEWATER_PALM_MATERIAL_GRAPH } from '../vegetation/VegetationMaterialGraph.js';
import { TIDEWATER_CANOPY_MATERIAL_GRAPH, TIDEWATER_CANOPY_NEAR_PBR_BASE_COLOR } from '../vegetation/CanopyMaterialGraph.js';

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
assert.ok( TIDEWATER_PALM_MATERIAL_GRAPH.nodes.some( node => node.op === 'valueNoise2' ), 'palm bark variation uses portable value noise' );
assert.match( webgpu.wgslHelpers, /fn emgValueNoise2/ );
assert.match( webgl.glsl.fragmentHelpers, /float emgValueNoise2/ );
assert.equal( TIDEWATER_PALM_MATERIAL_GRAPH.nodes.length <= 1024, true, 'palm material remains inside the signed graph node limit' );

assert.equal( validateWorldMaterialGraph( TIDEWATER_CANOPY_MATERIAL_GRAPH ), TIDEWATER_CANOPY_MATERIAL_GRAPH, 'near canopy appearance satisfies the renderer-neutral graph contract' );
assert.deepEqual( TIDEWATER_CANOPY_NEAR_PBR_BASE_COLOR, [ 1, 1, 1 ], 'the GLB base factor leaves authored color to the material graph' );
const canopyWebGPU = compileWorldMaterialGraph( TIDEWATER_CANOPY_MATERIAL_GRAPH, 'webgpu', { doubleSided: true } );
const canopyWebGL = compileWorldMaterialGraph( TIDEWATER_CANOPY_MATERIAL_GRAPH, 'webgl', { doubleSided: true } );
for ( const [ name, compiled ] of [ [ 'WebGPU', canopyWebGPU ], [ 'WebGL', canopyWebGL ] ] ) {
	for ( const input of [ 'uv', 'vdata', 'vdata1', 'instanceMaterial0', 'normal', 'cameraPosition', 'worldPosition', 'sunDirection', 'night' ] ) {
		assert.ok( compiled.inputs.includes( input ), `${name} consumes authored canopy input ${input}` );
	}
	assert.deepEqual( compiled.textureSlots, [ 'leafMask' ], `${name} samples the signed linear leaf mask` );
	assert.match( compiled.surface, /translucency/ );
}
assert.ok( TIDEWATER_CANOPY_MATERIAL_GRAPH.nodes.some( node => node.op === 'hash12' ), 'canopy species and instance tint use authored seed data' );
assert.ok( TIDEWATER_CANOPY_MATERIAL_GRAPH.nodes.filter( node => node.op === 'valueNoise2' ).length >= 3, 'bark weathering and moss use portable value noise' );
assert.ok( TIDEWATER_CANOPY_MATERIAL_GRAPH.nodes.length <= 1024, 'canopy material remains within the signed graph node limit' );

console.log( 'Tidewater renderer-neutral palm and canopy material graphs: ok' );
