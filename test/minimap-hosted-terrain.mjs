import assert from 'node:assert/strict';
import { Minimap } from '../game/Minimap.js';

const terrain = {
	res: 2048,
	texel: 1,
	origin: - 1024,
	heightAt: ( x ) => x < 0 ? - 1 : 1,
};
const minimap = Object.create( Minimap.prototype );
let mapInstalled = false;
minimap.game = {
	terrain,
	app: {}, // Hosted worlds do not populate the engine's built-in terrainData field.
	fishingAreas: { pier: { x: 0, width: 4, zStart: 0, zEnd: 20, headWidth: 8, headDepth: 6 } },
	habitatAtPoint: () => ( {} ),
};
minimap.mapCanvas = {};
minimap.navigator = { setMap: () => { mapInstalled = true; } };
minimap._bake = {
	row: 0,
	ctx: { putImageData() {}, fillRect() {}, strokeRect() {} },
	img: { data: new Uint8ClampedArray( 640 * 640 * 4 ) },
	h: new Float32Array( 640 * 640 ),
	done: false,
};

assert.doesNotThrow( () => { while ( ! minimap._bake.done ) minimap._bakeStep(); } );
assert.equal( minimap._bake.done, true );
assert.equal( mapInstalled, true );
assert.deepEqual( minimap._richest( 0, 0, 100 ), [] );

console.log( 'Tidewater minimap supports hosted heightfield terrain without built-in terrain masks.' );
