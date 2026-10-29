import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { hostedCollisionBoxes } from '../../../src/fallback/WebGLComponentSupport.js';
import { Colliders } from '../../../src/world/Colliders.js';
import { Vector3 } from '../../../src/engine/math/Vector3.js';

const source = JSON.parse( await readFile( new URL( '../world-source.json', import.meta.url ) ) );
const village = source.objects.find( object => object.id === 'elsemesh-object:island-village' );
const authoredDeck = hostedCollisionBoxes( village.collision ).find( box => box.center[ 0 ] === 55 && box.halfExtents[ 2 ] > 40 );
assert.ok( authoredDeck?.walkable && authoredDeck.solid, 'the hosted WebGL collision adapter recognizes Tidewater’s authored pier deck' );
const colliders = new Colliders();
colliders.addBox( new Vector3( ...authoredDeck.center ), new Vector3( ...authoredDeck.halfExtents ), authoredDeck.yaw, { walkable: authoredDeck.walkable, solid: authoredDeck.solid } );
assert.equal( colliders.groundHeightAt( 55, -30, 3 ), 2.3, 'the hosted WebGL pier deck is a ground surface rather than a fall-through solid' );

console.log( 'Tidewater hosted WebGL pier collision: ok' );
