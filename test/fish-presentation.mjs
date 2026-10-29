import assert from 'node:assert/strict';
import * as presentation from '../FishPresentation.js';
import source from '../world-source.json' with { type: 'json' };
import { isFishCatalog } from '../FishTable.js';
import { createPropMaterial, createSwimMaterial } from '../../../src/world/fish/FishMaterial.js';

const { PATTERN, SPECIES, SKIN } = presentation;
const names = Object.keys( PATTERN ).sort( ( a, b ) => PATTERN[ a ] - PATTERN[ b ] );
assert.deepEqual( names.map( name => PATTERN[ name ] ), Array.from( { length: 21 }, ( _, id ) => id ), 'fish shader pattern IDs remain stable from 0 through 20' );
assert.deepEqual( Object.keys( SPECIES ).sort(), Object.keys( PATTERN ).sort(), 'every authored pattern has anatomy data' );
assert.deepEqual( Object.keys( SKIN ).sort(), Object.keys( PATTERN ).sort(), 'every authored pattern has skin data' );
for ( const name of names ) {
	assert.equal( SPECIES[ name ].pattern, PATTERN[ name ], `${name} anatomy selects its stable shader pattern` );
	assert( Number.isFinite( SPECIES[ name ].body ) && SPECIES[ name ].body > 0 && SPECIES[ name ].body <= 1, `${name} has normalized body anatomy` );
	assert( Number.isInteger( SKIN[ name ].back ) && Number.isFinite( SKIN[ name ].rough ), `${name} has authored skin values` );
}

const catalog = source.experience.behaviors[ 'elsemesh.fishing-game/1' ].fishCatalog;
assert( isFishCatalog( catalog ), 'Tidewater fishing catalog remains valid' );
for ( const [ id, fish ] of Object.entries( catalog ) ) assert( Object.hasOwn( SPECIES, fish.model ), `${id} maps to an authored renderer profile model` );

const batch = {
	module: {},
	recordIndex: () => '0u',
	record: () => [ 'vec4f( 0.0 )', 'vec4f( 0.0 )', 'vec4f( 0.0 )', 'vec4f( 0.0 )' ],
};
assert( createPropMaterial( batch, { presentation } ).modules[ 0 ], 'fish props build a shader from the injected profile' );
assert( createSwimMaterial( batch, { presentation } ).vertex.includes( String( PATTERN.eagleRay ) ), 'swimming vertex patterns come from the injected profile' );

console.log( 'Tidewater fish presentation content: ok' );
