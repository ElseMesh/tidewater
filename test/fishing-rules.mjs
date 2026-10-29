import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createWorldBehaviorRuntime, worldBehaviorsFor } from '../../../src/network/WorldBehaviorRegistry.js';
import { validateWorldSource } from '../../../src/network/WorldSource.js';
import { run as runFishingRulesExtension } from '../extensions/fishing-game-rules.js';

const source = JSON.parse( await readFile( new URL( '../world-source.json', import.meta.url ), 'utf8' ) );
validateWorldSource( source );
assert.equal( source.experience.extensions.length, 1, 'Tidewater packages its signed fishing rules extension' );
assert.equal( source.experience.extensions[ 0 ].behaviorId, 'elsemesh.fishing-game/1' );
const extensionBytes = await readFile( new URL( `../assets/${source.experience.extensions[ 0 ].assetId.slice( 'sha256:'.length )}`, import.meta.url ) );
assert.equal( `sha256:${createHash( 'sha256' ).update( extensionBytes ).digest( 'hex' )}`, source.experience.extensions[ 0 ].assetId, 'the Worker module bytes match their content-addressed package reference' );
assert.equal( source.rules.requiredFeatures.includes( 'elsemesh.world-extension/1' ), false );
const fishingBehavior = worldBehaviorsFor( source.experience ).find( behavior => behavior.id === 'elsemesh.fishing-game/1' );
assert.ok( fishingBehavior?.data.biteRateSchedule, 'Tidewater authors its bite schedule as behavior data' );

const extensionManager = { has: () => true, ready: () => Promise.resolve( runFishingRulesExtension( { type: 'initialize', behaviorData: fishingBehavior.data } ) ) };
const runtime = createWorldBehaviorRuntime( source.experience, 'elsemesh.fishing-game/1', { load: false, worldId: source.worldId, extensions: extensionManager } );
await runtime.extensionReady;
const initialized = await extensionManager.ready();
assert.equal( initialized.biteRateMultipliers.length, 240, 'the Worker compiles a bounded day of tenth-hour rates' );
for ( const [ hour, expected ] of [
	[ -1, 0.8 ], [ 0, 0.8 ], [ 4.999, 0.8 ], [ 5, 1.4 ], [ 8, 1.4 ], [ 8.1, 1 ],
	[ 16.999, 1 ], [ 17, 1.4 ], [ 20, 1.4 ], [ 20.1, 1 ], [ 21.999, 1 ], [ 22, 0.8 ], [ 24, 0.8 ],
] ) {
	runtime.bite = { phase: 'wait', t: 10 };
	runtime.stepBite( 1, { habitat: () => ( { shallows: 1 } ), hour } );
	assert.equal( runtime.bite.t, 10 - expected, `bite wait rate at ${hour} hours` );
}

assert.throws( () => runFishingRulesExtension( { type: 'initialize', behaviorData: { biteRateSchedule: { defaultMultiplier: 1, windows: [ { startHour: 4, endHour: 6, multiplier: 1.2 }, { startHour: 5, endHour: 7, multiplier: 1.3 } ] } } } ), /invalid bite-rate schedule window/ );
assert.throws( () => runFishingRulesExtension( { type: 'initialize', behaviorData: { biteRateSchedule: { defaultMultiplier: 1, windows: [ { startHour: 5.05, endHour: 6, multiplier: 1 } ] } } } ), /invalid bite-rate schedule window/ );

runtime.bite = { phase: 'take', t: 10 };
runtime.stepBite( 1, { habitat: () => ( { shallows: 1 } ), hour: 6 });
assert.equal( runtime.bite.t, 9, 'the schedule changes waiting time only; fish take timing stays unchanged' );

console.log( 'Tidewater fishing rules: declarative schedule parity passed' );
