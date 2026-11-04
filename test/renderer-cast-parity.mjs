import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PerspectiveCamera } from '../../../src/engine/index.js';
import { FishingGameRuntime } from '../FishingGameRuntime.js';
import { GameState } from '../GameState.js';
import { FishingRod } from '../game/FishingRod.js';
import { Game } from '../game/Game.js';
import { FishingInputController } from '../FishingInputController.js';
import { WebGLGameAdapter } from '../webgl/WebGLGameAdapter.js';
import { createFishingTestRuntime } from './fishing-test-extension.mjs';
import { SyntheticWaterQuery } from './synthetic-water-query.mjs';

const experience = JSON.parse( await readFile( new URL( '../world-source.json', import.meta.url ), 'utf8' ) ).experience;
const fishingBehavior = experience.behaviors[ 'elsemesh.fishing-game/1' ];
const fishCatalog = fishingBehavior.fishCatalog;
const behaviorData = { fishCatalog, biteRateSchedule: fishingBehavior.biteRateSchedule };
const dt = 1 / 60;
// Golden from the pre-split WebGPU FishingRod/Game cast path at 23c30bf.
// It covers rod equip, charge, cast flight, water landing, and retrieval.
const PRE_SPLIT_CAST_SHA256 = 'cb90357158b6b5a157aeb7a6c3e727f10a1fe51c24eede0411cc47352771687d';
const traceHash = value => createHash( 'sha256' ).update( JSON.stringify( value ) ).digest( 'hex' );

async function createScenario( backend ) {

	const storage = { getItem: () => null, setItem() {} };
	const state = new GameState( storage, `elsemesh:cast-${backend}`, fishCatalog );
	const runtime = new FishingGameRuntime( { state, load: false, behaviorData } );
	await createFishingTestRuntime( runtime, behaviorData );
	const terrain = { heightAt: () => - 8 };
	const query = new SyntheticWaterQuery( terrain );
	const camera = new PerspectiveCamera( 62, 1, 0.1, 500 );
	camera.position.set( 0, 2, 0 );
	camera.updateMatrixWorld();
	const rod = new FishingRod( { camera, query, terrain, render: false } );
	const player = { position: camera.position.clone(), mode: 'walk', surface: 'wood', busy: false, prompt: null };
	const pressed = new Set();
	const input = { enabled: true, mouseDown: false, rightDown: false, hit: code => pressed.delete( code ) };
	const fishingInput = new FishingInputController();
	const pendingBiteSteps = [];
	const pendingActions = [];
	const audio = { events: [], fishSplash: ( _, strength ) => audio.events.push( [ 'splash', strength ] ), fishFlop: () => audio.events.push( [ 'flop' ] ), coin: () => audio.events.push( [ 'coin' ] ) };
	const toasts = [];
	const stepBite = runtime.stepBite.bind( runtime );
	runtime.stepBite = ( ...args ) => {
		const promise = stepBite( ...args );
		pendingBiteSteps.push( promise );
		return promise;
	};
	let landing = null, landingReady = Promise.resolve( null );
	let update, game;

	if ( backend === 'webgpu' ) {

		const app = { player, camera, input, settings: { timeOfDay: 12 }, audio, freeCam: false, ui: null };
		game = Object.assign( Object.create( Game.prototype ), {
			app, runtime, state, fishCatalog, fishingAreas: experience.behaviors[ 'elsemesh.fishing-game/1' ].fishingAreas,
			rod, fishingInput, hud: { invOpen: false, standOpen: false, update() {}, showCatch() {} }, landing: null,
			display: { shown: false, show() { this.shown = true; }, hide() { this.shown = false; } }, vendors: [],
			boatGameplay: { step: () => ( { fuel: null, sonar: null } ) }, toast: ( ...args ) => toasts.push( args ),
		} );
		rod.onLand = where => { landing = where; landingReady = game.onBobberLanded( where ); };
		update = () => game.update( dt );

	} else {

		const ui = {
			root: { dataset: {} }, promptKey: { textContent: '' }, promptText: { textContent: '' },
			prompt: { classList: { toggle() {} } }, toast() {},
		};
		const hud = { standOpen: false, invOpen: false, catchOpen: false, update() {}, showCatch() {}, closeStand() {}, hideCatch() {} };
		game = Object.assign( Object.create( WebGLGameAdapter.prototype ), {
			runtime, state, fishCatalog, fishingAreas: experience.behaviors[ 'elsemesh.fishing-game/1' ].fishingAreas,
			rod, fishingInput, hud, ui, audio, landing: null,
			vendor: { name: 'Joe · Fish buyer' }, vendors: [],
			boatGameplay: { step: () => ( { fuel: null, sonar: null } ) }, toast: ( ...args ) => toasts.push( args ),
		} );
		rod.onLand = where => { landing = where; landingReady = game._onBobberLanded( where ); };
		update = () => game.update( dt, player, input, { timeOfDay: 12 } );

	}
	const asyncMethods = backend === 'webgpu' ? [ 'strike', 'updateFight' ] : [ '_strike', '_stepFight' ];
	for ( const name of asyncMethods ) {
		const original = game[ name ].bind( game );
		game[ name ] = ( ...args ) => {
			const promise = original( ...args );
			pendingActions.push( promise );
			return promise;
		};
	}

	return {
		backend, runtime, rod, query, input, pressed, player, game, audio, toasts, pendingBiteSteps, pendingActions,
		landing: () => landing,
		landingReady: () => landingReady,
		frame() { query.update( dt ); update(); },
		async flush() {
			while ( pendingBiteSteps.length || pendingActions.length ) {
				await Promise.all( [ ...pendingBiteSteps.splice( 0 ), ...pendingActions.splice( 0 ) ] );
			}
		},
	};

}

async function castAndCancel( backend ) {

	const scenario = await createScenario( backend );
	const trace = [];
	const snapshot = () => ( {
		state: scenario.rod.state,
		power: scenario.rod.power,
		lineOut: scenario.rod.lineOut,
		bobber: scenario.rod.bobber.toArray(),
		velocity: scenario.rod.bobberVel.toArray(),
	} );
	const frame = () => { scenario.frame(); trace.push( snapshot() ); };

	scenario.pressed.add( 'KeyR' );
	frame();
	assert.equal( scenario.rod.equipped, true, `${backend} accepts the rod-toggle input` );
	scenario.input.mouseDown = true;
	frame();
	for ( let i = 0; i < 120 && scenario.rod.power < 1; i ++ ) frame();
	assert.equal( scenario.rod.power, 1, `${backend} charges the cast` );
	scenario.input.mouseDown = false;
	frame();
	for ( let i = 0; i < 480 && scenario.landing() === null; i ++ ) frame();
	assert.equal( scenario.landing(), 'water', `${backend} lands the cast on water` );
	await scenario.landingReady();
	assert.ok( scenario.runtime.bite, `${backend} starts fishing rule state after landing` );

	const castResult = {
		trace,
		landing: scenario.landing(),
		bite: scenario.runtime.bite,
		rod: snapshot(),
	};
	scenario.input.rightDown = true;
	frame();
	await Promise.all( scenario.pendingBiteSteps.splice( 0 ) );
	assert.equal( scenario.rod.state, 'retrieving', `${backend} reels in after right-click` );
	assert.equal( scenario.runtime.bite, null, `${backend} cancels bite state on retrieval` );
	return { castResult, cancel: { rod: snapshot(), bite: scenario.runtime.bite, fight: scenario.runtime.fight } };

}

async function playThroughSale( backend ) {

	const scenario = await createScenario( backend );
	const frame = async () => { scenario.frame(); await scenario.flush(); };
	const snapshots = { cast: [], bite: [], fight: [] };
	const fightSnapshot = fight => fight && Object.fromEntries( Object.entries( fight ).filter( ( [ key, value ] ) => key !== 'rng' && typeof value !== 'function' ) );
	const push = ( collection, value ) => collection.push( structuredClone( value ) );

	scenario.pressed.add( 'KeyR' );
	await frame();
	scenario.input.mouseDown = true;
	await frame();
	for ( let i = 0; i < 120 && scenario.rod.power < 1; i ++ ) await frame();
	scenario.input.mouseDown = false;
	await frame();
	for ( let i = 0; i < 480 && scenario.landing() === null; i ++ ) {
		scenario.frame();
		push( snapshots.cast, { state: scenario.rod.state, bobber: scenario.rod.bobber.toArray(), velocity: scenario.rod.bobberVel.toArray() } );
		await scenario.flush();
	}
	assert.equal( scenario.landing(), 'water', `${backend} full gameplay cast lands on water` );
	await scenario.landingReady();
	assert.equal( scenario.runtime.bite?.phase, 'wait', `${backend} starts the authored fishing bite schedule` );

	for ( let i = 0; i < 60 * 90 && scenario.runtime.bite?.phase !== 'take'; i ++ ) {
		scenario.frame();
		await scenario.flush();
		push( snapshots.bite, scenario.runtime.bite );
	}
	assert.equal( scenario.runtime.bite?.phase, 'take', `${backend} fishing rules advance from cast landing through nibble to take` );

	scenario.input.mouseDown = true;
	await frame();
	assert.ok( scenario.runtime.fight, `${backend} input hooks the fishing rule module's take` );
	push( snapshots.fight, fightSnapshot( scenario.runtime.fight ) );
	for ( let i = 0; i < 60 * 180 && scenario.runtime.fight; i ++ ) {
		const fight = scenario.runtime.fight;
		scenario.input.mouseDown = fight.tension < 0.68 && fight.surge < 0.6;
		scenario.frame();
		await scenario.flush();
		push( snapshots.fight, fightSnapshot( scenario.runtime.fight ) );
	}
	assert.equal( scenario.runtime.fight, null, `${backend} fight reaches a terminal outcome` );
	assert.equal( scenario.rod.state, 'landing', `${backend} presents the caught fish after the fight` );
	assert.equal( scenario.runtime.state.inventory.length, 1, `${backend} records the caught fish in inventory` );
	const caught = {
		landing: scenario.game.landing && ( ( { species, kg, card } ) => ( { species, kg, card } ) )( scenario.game.landing ),
		inventory: scenario.runtime.state.inventory,
		money: scenario.runtime.state.money,
		audio: scenario.audio.events,
		toasts: scenario.toasts,
	};
	const sale = scenario.game.sellAll();
	return {
		snapshots: Object.fromEntries( Object.entries( snapshots ).map( ( [ stage, trace ] ) => [ stage, { frames: trace.length, sha256: traceHash( trace ) } ] ) ),
		caught, sale,
		final: { inventory: scenario.runtime.state.inventory, money: scenario.runtime.state.money, audio: scenario.audio.events, toasts: scenario.toasts },
	};

}

const previousRandom = Math.random;
let webgpu, webgl;
try {
	Math.random = () => 0x71de / 0x100000000;
	webgpu = await castAndCancel( 'webgpu' );
	webgl = await castAndCancel( 'webgl' );
	const fullWebGPU = await playThroughSale( 'webgpu' );
	const fullWebGL = await playThroughSale( 'webgl' );
	assert.deepEqual( fullWebGL, fullWebGPU, 'full cast, fishing-rule bite, fight, catch and sale traces match across renderers' );
	console.log( `Full WebGPU/WebGL cast-to-sale parity passed (${fullWebGPU.snapshots.bite.frames} bite frames, ${fullWebGPU.snapshots.fight.frames - 1} fight frames)` );
} finally {
	Math.random = previousRandom;
}

assert.deepEqual( webgl, webgpu, 'the actual WebGPU Game and WebGL adapter match rod, landing, bite-start, and cancel traces' );
assert.equal(
	createHash( 'sha256' ).update( JSON.stringify( webgpu.castResult.trace ) ).digest( 'hex' ),
	PRE_SPLIT_CAST_SHA256,
	'the current WebGPU Game cast trace matches the pre-split WebGPU FishingRod trace at 23c30bf',
);
console.log( `WebGPU/WebGL cast-to-water and cancel parity passed (${webgpu.castResult.trace.length} fixed-step frames)` );
