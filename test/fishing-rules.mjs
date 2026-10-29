import assert from 'node:assert/strict';
import '../register-behavior.js';
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

const extensionManager = {
	has: () => true,
	ready: () => Promise.resolve( runFishingRulesExtension( { type: 'initialize', behaviorData: fishingBehavior.data } ) ),
	run: ( _id, event ) => Promise.resolve( runFishingRulesExtension( event ) ),
};
const runtime = createWorldBehaviorRuntime( source.experience, 'elsemesh.fishing-game/1', { load: false, worldId: source.worldId, extensions: extensionManager } );
await runtime.extensionReady;
const initialized = await extensionManager.ready();
assert.equal( initialized.initialized, true, 'the Worker compiles the authored schedule internally' );
const isolatedA = createWorldBehaviorRuntime( source.experience, 'elsemesh.fishing-game/1', { load: false, worldId: 'elsemesh:fishing-runtime-a' } );
const isolatedB = createWorldBehaviorRuntime( source.experience, 'elsemesh.fishing-game/1', { load: false, worldId: 'elsemesh:fishing-runtime-b' } );
assert.notEqual( isolatedA.state, isolatedB.state, 'Tidewater creates one browser gameplay state per thruhold' );
assert.notEqual( isolatedA.state.storageKey, isolatedB.state.storageKey, 'Tidewater browser saves are isolated by thruhold identity' );
assert.equal( isolatedA.state.storageKey, 'elsemesh.save.v1:elsemesh%3Afishing-runtime-a' );
await assert.rejects( isolatedA.startBite( { shallows: 1 }, 12 ), /signed JavaScript extension/, 'simulation still requires the signed Tidewater Worker' );
for ( const [ hour, expected ] of [
	[ -1, 0.8 ], [ 0, 0.8 ], [ 4.999, 0.8 ], [ 5, 1.4 ], [ 8, 1.4 ], [ 8.1, 1 ],
	[ 16.999, 1 ], [ 17, 1.4 ], [ 20, 1.4 ], [ 20.1, 1 ], [ 21.999, 1 ], [ 22, 0.8 ], [ 24, 0.8 ],
] ) {
	await runtime.startBite( { shallows: 1 }, 12, 12345 );
	const initialTime = runtime.bite.t;
	await runtime.stepBite( 1, { habitat: () => ( { shallows: 1 } ), hour } );
	assert.equal( runtime.bite.t, initialTime - expected, `bite wait rate at ${hour} hours` );
}

assert.throws( () => runFishingRulesExtension( { type: 'initialize', behaviorData: { fishCatalog: fishingBehavior.data.fishCatalog, biteRateSchedule: { defaultMultiplier: 1, windows: [ { startHour: 4, endHour: 6, multiplier: 1.2 }, { startHour: 5, endHour: 7, multiplier: 1.3 } ] } } } ), /invalid bite-rate schedule window/ );
assert.throws( () => runFishingRulesExtension( { type: 'initialize', behaviorData: { fishCatalog: fishingBehavior.data.fishCatalog, biteRateSchedule: { defaultMultiplier: 1, windows: [ { startHour: 5.05, endHour: 6, multiplier: 1 } ] } } } ), /invalid bite-rate schedule window/ );

const startedFight = runFishingRulesExtension( { type: 'start-fight', species: 'grunt', kg: 0.8, lineKg: 7, reelSpeed: 1.1, distance: 3, seed: 12345 } );
assert.equal( startedFight.fight.state, 'fighting', 'the signed module owns fight initialization and state' );
const fightStep = runFishingRulesExtension( { type: 'step-fight', steps: [ { dt: 1 / 60, reeling: true }, { dt: 1 / 60, reeling: false } ] } );
assert.equal( fightStep.results.length, 2, 'the module advances ordered frame inputs in a bounded batch' );
assert.equal( fightStep.results[ 1 ].fight.time, 2 / 60, 'the worker returns deterministic serialized fight snapshots' );
assert.deepEqual( runFishingRulesExtension( { type: 'cancel' } ), { cancelled: true }, 'cancellation clears module-owned fight state' );

await runtime.startBite( { shallows: 1 }, 12, 12345 );
for ( let i = 0; runtime.bite.phase !== 'take' && i < 60; i ++ ) await runtime.stepBite( 1, { habitat: { shallows: 1 }, hour: 12 } );
assert.equal( runtime.bite.phase, 'take', 'the Worker advances a waiting bite through nibble to take' );
const takeTime = runtime.bite.t;
await runtime.stepBite( 1, { habitat: { shallows: 1 }, hour: 6 } );
assert.equal( runtime.bite.t, takeTime - 1, 'the authored schedule changes waiting time only' );

console.log( 'Tidewater fishing rules: declarative schedule parity passed' );
