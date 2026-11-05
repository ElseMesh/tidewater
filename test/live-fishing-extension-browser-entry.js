import { PerspectiveCamera } from '../../../src/engine/index.js';
import { App } from '../../../src/App.js';
import { WorldConnector } from '../../../src/network/WorldConnector.js';
import { createWorldBehaviorExtensions, createWorldBehaviorRuntime, dispatchWorldBehaviorHooks } from '../../../src/network/WorldBehaviorRegistry.js';
import { GameState } from '../GameState.js';
import { FishingRod } from '../game/FishingRod.js';
import { Game } from '../game/Game.js';
import { FishingInputController } from '../FishingInputController.js';
import { WebGLGameAdapter } from '../webgl/WebGLGameAdapter.js';
import { SyntheticWaterQuery } from './synthetic-water-query.mjs';
import '../register-behavior.js';

const result = document.querySelector( '#result' );
const query = new URLSearchParams( location.search );
const behaviorId = 'elsemesh.fishing-game/1';
let connector;
const extensionSets = [];

function invariant( condition, message, detail = '' ) {
	if ( ! condition ) throw new Error( `${message}${detail ? `: ${detail}` : ''}` );
}

async function createScenario( backend, { experience, assets, worldId, fishCatalog } ) {
	let extensions = backend === 'webgl' ? createWorldBehaviorExtensions( experience, assets ) : null;
	if ( extensions ) extensionSets.push( extensions );
	const storage = { getItem: () => null, setItem() {} };
	const state = new GameState( storage, worldId, fishCatalog );
	const runtime = createWorldBehaviorRuntime( experience, behaviorId, { state, load: false, worldId, extensions } );
	await runtime.extensionReady;
	const terrain = { heightAt: () => - 8 };
	const waterQuery = new SyntheticWaterQuery( terrain );
	const camera = new PerspectiveCamera( 62, 1, 0.1, 500 );
	camera.position.set( 0, 2, 0 );
	camera.updateMatrixWorld();
	const rod = new FishingRod( { camera, query: waterQuery, terrain, render: false } );
	const player = { position: camera.position.clone(), mode: 'walk', surface: 'wood', busy: false, prompt: null };
	const pressed = new Set();
	const input = { enabled: true, mouseDown: false, rightDown: false, hit: code => pressed.delete( code ) };
	const fishingInput = new FishingInputController();
	const audio = {
		events: [],
		fishSplash: ( _, strength ) => audio.events.push( [ 'splash', strength ] ),
		fishFlop: () => audio.events.push( [ 'flop' ] ),
		coin: () => audio.events.push( [ 'coin' ] ),
	};
	const toasts = [], pending = [];
	const originalStepBite = runtime.stepBite.bind( runtime );
	runtime.stepBite = ( ...args ) => {
		const promise = originalStepBite( ...args );
		pending.push( promise );
		return promise;
	};
	const fishBehavior = experience.behaviors[ behaviorId ];
	let game, app, fallback, landing = null, landingReady = Promise.resolve( null ), gameFrames = 0;
	if ( backend === 'webgpu' ) {
		app = Object.assign( Object.create( App.prototype ), {
			player, camera, input, settings: { timeOfDay: 12 }, audio, freeCam: false, ui: null,
			worldExtensionGeneration: 0, activeHostedExperience: null, activeHostedExtensions: null,
			localLights: { setWorldPackage() {} }, worldPresence: null, activeHostedBoat: null,
			worldGames: new Map(), hostedWaterSurface: {}, hostedQueries: new WeakMap(),
			hostedColliders: {}, hostedQuery: waterQuery, hostedPlayerSlot: 0,
			query: waterQuery, colliders: {},
		} );
		game = Object.assign( Object.create( Game.prototype ), {
			app, runtime, state, fishCatalog, fishingAreas: fishBehavior.fishingAreas, active: true,
			rod, fishingInput, hud: { invOpen: false, standOpen: false, update() {}, showCatch() {}, closeStand() {} }, landing: null,
			stand: { setColliders() {}, setActive() {} }, chandlery: { setColliders() {}, setActive() {} },
			display: { mesh: { visible: true }, shown: false, show() { this.shown = true; }, hide() { this.shown = false; } }, vendors: [],
			boatGameplay: { step: () => ( { fuel: null, sonar: null } ), setTerrain() {}, setController() {} }, toast: ( ...args ) => toasts.push( args ),
		} );
		app.game = game;
		app.worldGames.set( worldId, game );
		app.hostedQueries.set( app.hostedWaterSurface, waterQuery );
		const updateGame = game.update.bind( game );
		game.update = dt => { gameFrames ++; updateGame( dt ); };
		rod.onLand = where => { landing = where; landingReady = game.onBobberLanded( where ); };
		const root = { userData: { worldComponents: [], terrainData: terrain } };
		app.activateHostedWorld( root, connector, { dispose() {} } );
		invariant( ! ( 'terrainData' in app ), 'hosted WebGPU fixture must not provide built-in terrainData' );
		invariant( game.terrain === terrain, 'Tidewater did not receive the hosted world terrain' );
		extensions = app.activeHostedExtensions;
		extensionSets.push( extensions );
		await runtime.extensionReady;
	} else {
		const ui = {
			root: { dataset: {} }, promptKey: { textContent: '' }, promptText: { textContent: '' },
			prompt: { classList: { toggle() {} } }, toast() {},
		};
		const hud = { standOpen: false, invOpen: false, catchOpen: false, update() {}, showCatch() {}, closeStand() {}, hideCatch() {} };
		game = Object.assign( Object.create( WebGLGameAdapter.prototype ), {
			runtime, state, fishCatalog, fishingAreas: fishBehavior.fishingAreas, rod, fishingInput, hud, ui, audio,
			landing: null, vendor: { name: 'Joe · Fish buyer' }, vendors: [],
			boatGameplay: { step: () => ( { fuel: null, sonar: null } ) }, toast: ( ...args ) => toasts.push( args ),
		} );
		rod.onLand = where => { landing = where; landingReady = game._onBobberLanded( where ); };
		fallback = {
			app: { settings: { timeOfDay: 12 } }, camera, input, player, freeCam: false,
			fishStand: null, chandlery: null, gameAdapter: game,
		};
	}
	const pendingActions = [];
	for ( const name of ( backend === 'webgpu' ? [ 'strike', 'updateFight' ] : [ '_strike', '_stepFight' ] ) ) {
		const original = game[ name ].bind( game );
		game[ name ] = ( ...args ) => {
			const promise = original( ...args );
			pendingActions.push( promise );
			return promise;
		};
	}
	return {
		game, runtime, rod, player, input, pressed, audio, toasts,
		landing: () => landing,
		landingReady: () => landingReady,
		gameFrames: () => backend === 'webgpu' ? gameFrames : null,
		frame() {
			const dt = 1 / 60;
			waterQuery.update( dt );
			if ( backend === 'webgpu' ) dispatchWorldBehaviorHooks( app.activeHostedExperience, 'onWorldFrame', { app, mode: 'hosted', dt, extensions: app.activeHostedExtensions } );
			else dispatchWorldBehaviorHooks( experience, 'onWebGLWorldFrame', { fallback, mode: 'hosted', dt, extensions } );
		},
		depart() {
			if ( backend === 'webgpu' ) {
				app.deactivateHostedWorld();
				invariant( ! game.active, 'WebGPU departure did not deactivate Tidewater gameplay' );
			} else extensions.dispose();
			invariant( ! extensions.has( behaviorId ), `${backend} departure did not dispose its signed gameplay Worker` );
		},
		async reenter() {
			invariant( backend === 'webgpu', 'only the hosted App path has an App activation lifecycle' );
			const previousExtensions = extensions;
			app.activateHostedWorld( { userData: { worldComponents: [], terrainData: terrain } }, connector, { dispose() {} } );
			extensions = app.activeHostedExtensions;
			extensionSets.push( extensions );
			await runtime.extensionReady;
			invariant( previousExtensions !== extensions && ! previousExtensions.has( behaviorId ), 'WebGPU re-entry did not replace and dispose the previous Worker set' );
			rod.state = 'idle';
			rod.equipped = false;
			const before = gameFrames;
			pressed.add( 'KeyR' );
			this.frame();
			await this.flush();
			invariant( gameFrames > before, 'WebGPU re-entry did not advance Tidewater gameplay through App frame hooks' );
			invariant( rod.equipped, 'WebGPU re-entry did not route rod-toggle input through Tidewater gameplay' );
		},
		async flush() {
			while ( pending.length || pendingActions.length ) await Promise.all( [ ...pending.splice( 0 ), ...pendingActions.splice( 0 ) ] );
		},
	};
}

async function playThroughSale( backend, context ) {
	const scenario = await createScenario( backend, context );
	const frame = async () => { scenario.frame(); await scenario.flush(); };
	const trace = { cast: [], bite: [], fight: [] };
	const snapshotFight = fight => fight && Object.fromEntries( Object.entries( fight ).filter( ( [ key, value ] ) => key !== 'rng' && typeof value !== 'function' ) );
	const snapshot = ( bucket, value ) => bucket.push( structuredClone( value ) );
	scenario.pressed.add( 'KeyR' );
	await frame();
	scenario.input.mouseDown = true;
	await frame();
	for ( let i = 0; i < 120 && scenario.rod.power < 1; i ++ ) await frame();
	scenario.input.mouseDown = false;
	await frame();
	for ( let i = 0; i < 480 && scenario.landing() === null; i ++ ) {
		scenario.frame();
		snapshot( trace.cast, { state: scenario.rod.state, bobber: scenario.rod.bobber.toArray(), velocity: scenario.rod.bobberVel.toArray() } );
		await scenario.flush();
	}
	invariant( scenario.landing() === 'water', `${backend} cast did not land in water` );
	await scenario.landingReady();
	invariant( scenario.runtime.bite?.phase === 'wait', `${backend} signed Worker did not start a bite` );
	for ( let i = 0; i < 60 * 90 && scenario.runtime.bite?.phase !== 'take'; i ++ ) {
		scenario.frame();
		await scenario.flush();
		snapshot( trace.bite, scenario.runtime.bite );
	}
	invariant( scenario.runtime.bite?.phase === 'take', `${backend} signed Worker did not produce a take` );
	scenario.input.mouseDown = true;
	await frame();
	invariant( !! scenario.runtime.fight, `${backend} input failed to hook the take` );
	snapshot( trace.fight, snapshotFight( scenario.runtime.fight ) );
	for ( let i = 0; i < 60 * 180 && scenario.runtime.fight; i ++ ) {
		const fight = scenario.runtime.fight;
		scenario.input.mouseDown = fight.tension < 0.68 && fight.surge < 0.6;
		scenario.frame();
		await scenario.flush();
		snapshot( trace.fight, snapshotFight( scenario.runtime.fight ) );
	}
	invariant( ! scenario.runtime.fight && scenario.rod.state === 'landing', `${backend} fight did not complete as a catch` );
	invariant( scenario.runtime.state.inventory.length === 1, `${backend} catch was not saved to inventory` );
	const caught = {
		landing: scenario.game.landing && ( ( { species, kg, card } ) => ( { species, kg, card } ) )( scenario.game.landing ),
		inventory: structuredClone( scenario.runtime.state.inventory ),
		money: scenario.runtime.state.money,
		audio: structuredClone( scenario.audio.events ),
		toasts: structuredClone( scenario.toasts ),
	};
	const sale = scenario.game.sellAll();
	invariant( sale.count === 1 && scenario.runtime.state.inventory.length === 0 && scenario.runtime.state.money === sale.total, `${backend} sale did not credit money and empty inventory` );
	const afterSale = structuredClone( { inventory: scenario.runtime.state.inventory, money: scenario.runtime.state.money, audio: scenario.audio.events, toasts: scenario.toasts } );
	scenario.depart();
	if ( backend === 'webgpu' ) {
		await scenario.reenter();
		scenario.depart();
	}
	return { trace, caught, sale, afterSale };
}

try {
	const worldId = query.get( 'worldId' );
	const nodeId = query.get( 'nodeId' );
	const gateway = query.get( 'gateway' );
	if ( ! worldId || ! nodeId || ! gateway ) throw new Error( 'Missing live gateway parameters' );
	connector = new WorldConnector( { worldId, nodeId, gateway } );
	const manifest = await connector.getManifest();
	if ( manifest.ownerPeerId !== nodeId || manifest.worldId !== worldId ) throw new Error( 'Gateway returned the wrong signed world manifest' );
	const reference = manifest.experience.extensions.find( item => item.behaviorId === behaviorId );
	if ( ! reference ) throw new Error( 'Signed Tidewater experience has no fishing extension' );
	const moduleBytes = await connector.getAsset( reference.assetId );
	if ( ! connector.assets.has( reference.assetId ) || moduleBytes.byteLength !== manifest.assets.find( asset => asset.id === reference.assetId )?.bytes ) throw new Error( 'Fishing module did not pass gateway asset verification' );
	const experience = manifest.experience;
	const behaviorData = experience.behaviors[ behaviorId ];
	if ( ! behaviorData ) throw new Error( 'Signed Tidewater manifest has no fishing behavior data' );
	const context = { experience, assets: new Map( [ [ reference.assetId, moduleBytes ] ] ), worldId, fishCatalog: behaviorData.fishCatalog };
	const previousRandom = Math.random;
	let webgpu, webgl;
	try {
		Math.random = () => 0x71de / 0x100000000;
		webgpu = await playThroughSale( 'webgpu', context );
		webgl = await playThroughSale( 'webgl', context );
	} finally {
		Math.random = previousRandom;
	}
	invariant( JSON.stringify( webgl ) === JSON.stringify( webgpu ), 'Live signed Worker gameplay differs between WebGPU and WebGL game paths' );
	result.textContent = `PASS signed Tidewater module through gateway and dedicated Workers via registered WebGPU/WebGL frame hooks; WebGPU App activation, gameplay frames, departure, and re-entry: ${JSON.stringify( { worldId, assetId: reference.assetId, biteFrames: webgpu.trace.bite.length, fightFrames: webgpu.trace.fight.length - 1, sale: webgpu.sale } )}`;
	result.dataset.status = 'passed';
} catch ( error ) {
	result.textContent = `FAIL ${error.stack || error}`;
	result.dataset.status = 'failed';
} finally {
	for ( const extensions of extensionSets ) extensions.dispose();
	connector?.close();
}
