import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWorldBehaviorRuntime, worldBehaviorsFor } from '../../../src/network/WorldBehaviorRegistry.js';
import { validateWorldSource } from '../../../src/network/WorldSource.js';

const source = JSON.parse( await readFile( new URL( '../world-source.json', import.meta.url ), 'utf8' ) );
validateWorldSource( source );
assert.equal( Object.hasOwn( source, 'extensions' ), false, 'world content no longer packages executable extensions' );
assert.equal( source.rules.requiredFeatures.includes( 'elsemesh.world-extension/1' ), false );
const fishingBehavior = worldBehaviorsFor( source.experience ).find( behavior => behavior.id === 'elsemesh.fishing-game/1' );
assert.ok( fishingBehavior?.data.biteRateSchedule, 'Tidewater authors its bite schedule as behavior data' );

const runtime = createWorldBehaviorRuntime( source.experience, 'elsemesh.fishing-game/1', { load: false, worldId: source.worldId } );
for ( const [ hour, expected ] of [
	[ -1, 0.8 ], [ 0, 0.8 ], [ 4.999, 0.8 ], [ 5, 1.4 ], [ 8, 1.4 ], [ 8.1, 1 ],
	[ 16.999, 1 ], [ 17, 1.4 ], [ 20, 1.4 ], [ 20.1, 1 ], [ 21.999, 1 ], [ 22, 0.8 ], [ 24, 0.8 ],
] ) {
	runtime.bite = { phase: 'wait', t: 10 };
	runtime.stepBite( 1, { habitat: () => ( { shallows: 1 } ), hour } );
	assert.equal( runtime.bite.t, 10 - expected, `bite wait rate at ${hour} hours` );
}

runtime.bite = { phase: 'take', t: 10 };
runtime.stepBite( 1, { habitat: () => ( { shallows: 1 } ), hour: 6 });
assert.equal( runtime.bite.t, 9, 'the schedule changes waiting time only; fish take timing stays unchanged' );

console.log( 'Tidewater fishing rules: declarative schedule parity passed' );
