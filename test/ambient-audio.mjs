import assert from 'node:assert/strict';
import { resolveTidewaterAmbientAudioGains } from '../AmbientAudio.js';

const assets = [ 'a', 'b', 'c', 'd' ].map( character => `sha256:${character.repeat( 64 )}` );
const data = { ambientAudio: assets.map( ( assetId, index ) => ( { assetId, condition: [ 'always', 'night', 'underwater', 'dawn' ][ index ] } ) ) };
const components = [ { id: 'elsemesh-component:island-ambience', beds: assets.map( assetId => ( { assetId, gain: 0.25 } ) ) } ];

const daylight = resolveTidewaterAmbientAudioGains( { data, components, daylight: 0.2, timeOfDay: 6, underwater: false } );
const factors = daylight[ components[ 0 ].id ];
assert.equal( factors[ 0 ], 1, 'always ambience remains active' );
assert.equal( factors[ 1 ], 0.8, 'Tidewater derives its night ambience from its own daylight state' );
assert.equal( factors[ 2 ], 0, 'Tidewater gates the underwater bed using its own underwater state' );
assert.ok( factors[ 3 ] > 0, 'Tidewater derives dawn ambience from its own time of day' );
const underwater = resolveTidewaterAmbientAudioGains( { data, components, daylight: 0.9, timeOfDay: 12, underwater: true } );
assert.equal( underwater[ components[ 0 ].id ][ 2 ], 1, 'the underwater ambience follows the destination world state independently' );

console.log( 'ok Tidewater-owned ambient audio state and gains' );
