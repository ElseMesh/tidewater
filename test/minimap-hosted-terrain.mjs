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
	state: { stats: { finder: false } },
	vendorPosition: () => null,
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

const elements = new Float32Array( 16 );
elements[ 10 ] = 1;
const camera = { matrixWorld: { elements }, position: { x: 12, y: 3, z: - 9 } };
const player = { mode: 'walk' };
let navigationFrame = null;
minimap.view = { camera, player, boat: null };
minimap._fishT = 0;
minimap._fishPts = [];
minimap.radiusM = 110;
minimap._hot = new Set();
minimap.navigator.update = frame => { navigationFrame = frame; };
minimap.update( 1 / 60 );
assert.deepEqual( navigationFrame.position, { x: 12, z: - 9 }, 'the same minimap accepts an explicit WebGL camera and player view' );
assert.equal( Math.abs( navigationFrame.forward.x ), 0, 'the world navigator receives the camera heading' );
assert.equal( navigationFrame.forward.z, - 1, 'the world navigator receives the camera heading' );

console.log( 'Tidewater minimap supports hosted heightfield terrain without built-in terrain masks.' );
