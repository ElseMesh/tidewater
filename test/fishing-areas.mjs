import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Game } from '../game/Game.js';
import { fishingHabitatAt } from '../game/Bites.js';
import { WebGLGameAdapter } from '../webgl/WebGLGameAdapter.js';
import '../register-behavior.js';

const source = JSON.parse( await readFile( new URL( '../world-source.json', import.meta.url ), 'utf8' ) );
const areas = source.experience.behaviors[ 'elsemesh.fishing-game/1' ].fishingAreas;
const webgpu = Object.create( Game.prototype );
const webgl = Object.create( WebGLGameAdapter.prototype );
webgpu.fishingAreas = areas;
webgl.fishingAreas = areas;

for ( const sample of [
	{ x: areas.pier.x, z: areas.pier.zEnd, depth: 4 },
	{ x: areas.reef.center[ 0 ], z: areas.reef.center[ 1 ], depth: 5 },
	{ x: 400, z: -400, depth: 32 },
] ) {
	const expected = fishingHabitatAt( { ...sample, areas } );
	assert.deepEqual( webgpu.habitatAtPoint( sample.x, sample.z, sample.depth ), expected, 'WebGPU gameplay derives fishing habitat from world data' );
	assert.deepEqual( webgl._habitatAtPoint( sample.x, sample.z, sample.depth ), expected, 'WebGL gameplay uses the same world-authored habitat calculation' );
}
assert.equal( webgpu.habitatAtPoint( areas.pier.x, areas.pier.zEnd, 4 ).pier, 1, 'authored pier coordinates retain full pier habitat weight' );
assert.equal( webgpu.habitatAtPoint( areas.reef.center[ 0 ], areas.reef.center[ 1 ], 5 ).reef, 1, 'authored reef coordinates retain full reef habitat weight' );
console.log( 'WebGPU and WebGL fishing habitats share Tidewater world data and one calculation' );
