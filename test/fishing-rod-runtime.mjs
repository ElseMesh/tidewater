import assert from 'node:assert/strict';
import { PerspectiveCamera } from '../../../src/engine/index.js';
import { FishingRod } from '../game/FishingRod.js';
import { SyntheticWaterQuery } from './synthetic-water-query.mjs';

const terrain = { heightAt: () => - 8 };
const query = new SyntheticWaterQuery( terrain );
const camera = new PerspectiveCamera( 62, 1, 0.1, 500 );
camera.position.set( 0, 2, 0 );
camera.updateMatrixWorld();
const rod = new FishingRod( { camera, query, terrain, render: false } );
rod.equip( true );
assert.equal( rod.startWindup(), true );

const dt = 1 / 60;
let landed = null;
rod.onLand = where => { landed = where; };
for ( let i = 0; i < 60 * 8 && ! landed; i ++ ) {
	query.update( dt );
	if ( rod.state === 'windup' && rod.power >= 1 ) rod.release();
	rod.update( dt, { visible: false } );
}

assert.equal( landed, 'water', 'renderer-independent rod simulation casts and detects a water landing' );
assert.equal( rod.state, 'floating' );
assert.ok( rod.lineOut > 0 );
assert.ok( [ ...rod.tip.toArray(), ...rod.bobber.toArray() ].every( Number.isFinite ) );

rod.hook();
const fight = { distance: rod.lineOut, tension: 0.3, surge: 0 };
for ( let i = 0; i < 180; i ++ ) {
	query.update( 0.1 );
	rod.update( 0.1, { visible: false, fight } );
	assert.ok( Number.isFinite( rod.bend ) && Math.abs( rod.bend ) < 1, 'rod bend stays bounded at the engine dt cap' );
	assert.ok( Number.isFinite( rod.lineOut ), 'line length stays finite at low frame rates' );
	assert.ok( [ ...rod.tip.toArray(), ...rod.bobber.toArray() ].every( Number.isFinite ), 'rod and bobber coordinates stay finite at low frame rates' );
}

console.log( 'headless fishing rod simulation and low-frame-rate bend stability: ok' );
