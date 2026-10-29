import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dispatchWorldBehaviorHooks } from '../../../src/network/WorldBehaviorRegistry.js';
import '../register-behavior.js';

const added = [];
const activations = [];
const game = { setWorldActive( active ) { activations.push( active ); } };
const source = JSON.parse( await readFile( new URL( '../world-source.json', import.meta.url ), 'utf8' ) );
const app = {
	localLights: { add( light ) { added.push( light ); } },
	terrainData: { heightAt( x, z ) { return x * 0.1 + z * 0.01; } },
	worldGames: new Map( [ [ source.worldId, game ] ] ),
};

dispatchWorldBehaviorHooks( source.experience, 'onBuiltinWorldActivated', {
	app, worldId: source.worldId, extensions: { has: () => true },
} );
assert.equal( added.length, 2, 'Tidewater installs one lantern for each authored vendor location' );
assert.equal( added[ 0 ].kind, 'lantern' );
assert.equal( added[ 0 ].intensity, 7.5 );
assert.ok( Math.abs( added[ 0 ].position.y - ( 49.9 * 0.1 - 74.6 * 0.01 + 1.85 ) ) < 1e-9, 'lantern height follows world terrain at the authored vendor position' );
assert.deepEqual( activations, [ true ], 'Tidewater fishing behavior activates its cached gameplay runtime' );
dispatchWorldBehaviorHooks( source.experience, 'onBuiltinWorldActivated', {
	app, worldId: source.worldId, extensions: { has: () => true },
} );
assert.equal( added.length, 2, 'activation is idempotent for a world' );
const otherWorld = { behaviors: { 'elsemesh.shore-aware-boat/1': {} } };
dispatchWorldBehaviorHooks( otherWorld, 'onBuiltinWorldActivated', { app, worldId: 'elsemesh:other-island', extensions: null } );
assert.equal( added.length, 2, 'a world without the fishing behavior receives no Tidewater vendor lights' );
console.log( 'Tidewater vendor lights use active behavior data and install once per world' );
