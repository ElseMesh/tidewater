import { PerspectiveCamera } from '../../../src/engine/index.js';
import { App } from '../../../src/App.js';
import { WorldConnector } from '../../../src/network/WorldConnector.js';
import { createWorldBehaviorExtensions, createWorldBehaviorRuntime, dispatchWorldBehaviorHooks } from '../../../src/network/WorldBehaviorRegistry.js';
import { Player } from '../../../src/player/Player.js';
import { GameState } from '../GameState.js';
import { TIDEWATER_LAYOUT } from '../layout.js';
import { FishingRod } from '../game/FishingRod.js';
import { FISH_STAND_VENDOR } from '../game/FishStandContent.js';
import { Game } from '../game/Game.js';
import { FishingInputController } from '../FishingInputController.js';
import { WebGLGameAdapter } from '../webgl/WebGLGameAdapter.js';
import { SyntheticWaterQuery } from './synthetic-water-query.mjs';
import { TerrainData } from '../terrain/TerrainData.js';
import '../register-behavior.js';

const result = document.querySelector( '#result' );
const query = new URLSearchParams( location.search );
const behaviorId = 'elsemesh.fishing-game/1';
let connector;
const extensionSets = [];

function invariant( condition, message, detail = '' ) {
	if ( ! condition ) throw new Error( `${message}${detail ? `: ${detail}` : ''}` );
}

async function createScenario( backend, { experience, assets, worldId, fishCatalog, authoredTerrain } ) {
	let extensions = backend === 'webgl' ? createWorldBehaviorExtensions( experience, assets ) : null;
	if ( extensions ) extensionSets.push( extensions );
	const storage = { getItem: () => null, setItem() {} };
	const state = new GameState( storage, worldId, fishCatalog );
	state.money = 1000;
	const boatController = { maxThrust: 10, pitchSpeed: 2, position: { x: 0, y: 0, z: 0 } };
	const runtime = createWorldBehaviorRuntime( experience, behaviorId, { state, load: false, worldId, extensions } );
	await runtime.extensionReady;
	const fishBehavior = experience.behaviors[ behaviorId ];
	const stand = fishBehavior.fishStand;
	const terrain = { heightAt: () => - 8 };
	const [ standX, standZ ] = stand.position;
	const authoredGroundY = authoredTerrain.heightAt( standX, standZ );
	const [ localX, localY, localZ ] = FISH_STAND_VENDOR.localPosition;
	const c = Math.cos( stand.yaw ), s = Math.sin( stand.yaw );
	const vendor = {
		name: FISH_STAND_VENDOR.name, kind: FISH_STAND_VENDOR.kind,
		position: {
			x: standX + localX * c + localZ * s,
			y: authoredGroundY + localY,
			z: standZ - localX * s + localZ * c,
		},
		radius: stand.interactionRadius ?? FISH_STAND_VENDOR.radius,
		inRange: player => Math.hypot( player.x - vendor.position.x, player.z - vendor.position.z ) < vendor.radius && Math.abs( player.y - vendor.position.y ) < 2.5,
		update() {},
	};
	const chandlery = fishBehavior.chandlery;
	const [ shopX, shopZ ] = chandlery.position;
	const shopLocal = { x: 0, y: 0, z: - 0.75 };
	const shopC = Math.cos( chandlery.yaw ), shopS = Math.sin( chandlery.yaw );
	const shopVendor = {
		name: 'Marta · Chandlery', kind: 'shop',
		position: {
			x: shopX + shopLocal.x * shopC + shopLocal.z * shopS,
			y: authoredTerrain.heightAt( shopX, shopZ ),
			z: shopZ - shopLocal.x * shopS + shopLocal.z * shopC,
		},
		radius: chandlery.interactionRadius,
		inRange: player => Math.hypot( player.x - shopVendor.position.x, player.z - shopVendor.position.z ) < shopVendor.radius && Math.abs( player.y - shopVendor.position.y ) < 2.5,
		update() {},
	};
	const waterQuery = new SyntheticWaterQuery( terrain );
	const camera = new PerspectiveCamera( 62, 1, 0.1, 500 );
	camera.position.set( 0, 2, 0 );
	camera.updateMatrixWorld();
	const rod = new FishingRod( { camera, query: waterQuery, terrain, render: false } );
	let player = { position: camera.position.clone(), mode: 'walk', surface: 'wood', busy: false, prompt: null };
	const pressed = new Set();
	const input = { enabled: true, mouseDown: false, rightDown: false, hit: code => pressed.delete( code ) };
	const walkKeys = new Set();
	const walkInput = {
		moveAxes: () => ( { x: Number( walkKeys.has( 'KeyD' ) ) - Number( walkKeys.has( 'KeyA' ) ), y: Number( walkKeys.has( 'KeyW' ) ) - Number( walkKeys.has( 'KeyS' ) ), sprint: 0 } ),
		down: code => walkKeys.has( code ), hit: () => false, consumeLook: () => ( { x: 0, y: 0 } ),
	};
	const walkColliders = { groundHeightAt: () => - Infinity, resolveCapsule() {} };
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
			rod, fishingInput, hud: {
				invOpen: false, standOpen: false, catchOpen: false, vendor: null, update() {},
				showCatch() { this.catchOpen = true; }, hideCatch() { this.catchOpen = false; },
				openStand( target ) { this.vendor = target; this.standOpen = true; },
				closeStand() { this.standOpen = false; },
			}, landing: null,
			stand: { setColliders() {}, setActive() {} }, chandlery: { setColliders() {}, setActive() {} },
			display: { mesh: { visible: true }, shown: false, show() { this.shown = true; }, hide() { this.shown = false; } }, vendors: [ vendor, shopVendor ],
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
		const hud = {
			standOpen: false, invOpen: false, catchOpen: false, vendor: null, update() {},
			showCatch() { this.catchOpen = true; }, hideCatch() { this.catchOpen = false; },
			openStand( target ) { this.vendor = target; this.standOpen = true; },
			closeStand() { this.standOpen = false; },
		};
		game = Object.assign( Object.create( WebGLGameAdapter.prototype ), {
			runtime, state, fishCatalog, fishingAreas: fishBehavior.fishingAreas, rod, fishingInput, hud, ui, audio,
			landing: null, vendor, vendors: [ vendor, shopVendor ], activeVendor: null,
			boatGameplay: { step: () => ( { fuel: null, sonar: null } ) }, toast: ( ...args ) => toasts.push( args ),
		} );
		rod.onLand = where => { landing = where; landingReady = game._onBobberLanded( where ); };
		fallback = {
			app: { settings: { timeOfDay: 12 } }, camera, input, player, freeCam: false,
			fishStand: null, chandlery: null, gameAdapter: game,
		};
	}
	await runtime.boatGameplay.setController( boatController );
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
		game, runtime, rod, player, input, pressed, audio, toasts, vendor, shopVendor,
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
			await runtime.boatGameplay.applyGear();
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
		async pressKey( code ) {
			if ( backend === 'webgpu' ) {
				pressed.add( code );
				this.frame();
			} else {
				const handled = dispatchWorldBehaviorHooks( experience, 'onWebGLKeyDown', { active: true, fallback, event: { code } } );
				invariant( handled, `WebGL ${code} was not routed through the registered world input hook` );
				this.frame();
			}
			await this.flush();
		},
		async sellAtVendor() {
			const start = TIDEWATER_LAYOUT.start.position;
			const walker = new Player( { camera, input: walkInput, terrain: authoredTerrain, colliders: walkColliders, worldLayout: TIDEWATER_LAYOUT } );
			walker.setHostedWorldPose( { x: start.x, y: authoredTerrain.heightAt( start.x, start.z ) + 1.62, z: start.z }, TIDEWATER_LAYOUT.start.yaw, 0 );
			player = walker;
			if ( backend === 'webgpu' ) app.player = walker;
			else fallback.player = walker;
			const fromStart = Math.hypot( vendor.position.x - walker.position.x, vendor.position.z - walker.position.z );
			invariant( fromStart > vendor.radius, 'authored start is outside Joe buyer range before walking' );
			walker.yaw = Math.atan2( -( vendor.position.x - walker.position.x ), -( vendor.position.z - walker.position.z ) );
			walkKeys.add( 'KeyW' );
			let walkFrames = 0;
			for ( ; walkFrames < 180; walkFrames ++ ) {
				walker.updateHostedWorld( 1 / 60 );
				this.frame();
				await this.flush();
				if ( vendor.inRange( walker.position ) ) break;
			}
			walkKeys.delete( 'KeyW' );
			for ( let frame = 0; frame < 8; frame ++ ) {
				walker.updateHostedWorld( 1 / 60 );
				this.frame();
				await this.flush();
			}
			invariant( walkFrames < 180 && vendor.inRange( walker.position ), `${backend} authored-start walk did not reach Joe's buyer radius` );
			const walk = { frames: walkFrames + 1, distance: Math.hypot( walker.position.x - start.x, walker.position.z - start.z ) };
			invariant( walk.distance > fromStart - vendor.radius, `${backend} buyer interaction did not require the Player to walk into range` );
			this.frame();
			await this.flush();
			if ( game.hud.catchOpen ) {
				await this.pressKey( 'KeyE' );
				invariant( ! game.hud.catchOpen, `${backend} E input did not dismiss the catch card before vendor interaction` );
			}
			this.frame();
			await this.flush();
			await this.pressKey( 'KeyE' );
			invariant( game.hud.standOpen, `${backend} E input did not open the nearby fish-buyer panel` );
			invariant( game.hud.vendor === vendor, `${backend} opened a panel for the wrong vendor` );
			const sale = game.sellAll();
			invariant( sale.count === 1 && state.inventory.length === 0 && state.money === 1000 + sale.total, `${backend} vendor sale did not credit the catch` );
			await this.pressKey( 'KeyE' );
			invariant( ! game.hud.standOpen, `${backend} E input did not close the fish-buyer panel` );
			return { ...sale, walk };
		},
		async buyUpgradeAtShop() {
			player.position.set( shopVendor.position.x, shopVendor.position.y + 1.7, shopVendor.position.z );
			invariant( shopVendor.inRange( player.position ), `${backend} test player is outside Marta's interaction range` );
			this.frame();
			await this.flush();
			await this.pressKey( 'KeyE' );
			invariant( game.hud.standOpen, `${backend} E input did not open the nearby upgrade shop` );
			invariant( game.hud.vendor === shopVendor, `${backend} opened the wrong vendor panel` );
			const moneyBefore = state.money;
			const purchase = game.buy( 'engine' );
			await runtime.boatGameplay.applyGear();
			invariant( purchase?.index === 1 && state.upgrades.engine === 1 && state.money === moneyBefore - 300, `${backend} upgrade purchase did not update browser game state` );
			invariant( Math.abs( boatController.maxThrust - 10 * 1.15 ** 2 ) < 1e-12 && Math.abs( boatController.pitchSpeed - 2 * 1.15 ) < 1e-12, `${backend} signed Worker did not apply the purchased boat-engine upgrade` );
			await this.pressKey( 'KeyE' );
			invariant( ! game.hud.standOpen, `${backend} E input did not close Marta's upgrade shop` );
			return { purchase, money: state.money, upgrades: structuredClone( state.upgrades ), maxThrust: boatController.maxThrust, pitchSpeed: boatController.pitchSpeed };
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
	const sale = await scenario.sellAtVendor();
	invariant( sale.count === 1 && scenario.runtime.state.inventory.length === 0 && scenario.runtime.state.money === 1000 + sale.total, `${backend} sale did not credit money and empty inventory` );
	const shop = await scenario.buyUpgradeAtShop();
	const afterSale = structuredClone( { inventory: scenario.runtime.state.inventory, money: scenario.runtime.state.money, audio: scenario.audio.events, toasts: scenario.toasts } );
	scenario.depart();
	if ( backend === 'webgpu' ) {
		await scenario.reenter();
		scenario.depart();
	}
	return { trace, caught, sale, shop, afterSale };
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
	const authoredTerrain = new TerrainData( { worldLayout: TIDEWATER_LAYOUT } );
	const context = { experience, assets: new Map( [ [ reference.assetId, moduleBytes ] ] ), worldId, fishCatalog: behaviorData.fishCatalog, authoredTerrain };
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
	result.textContent = `PASS signed Tidewater module through gateway and dedicated Workers; WebGPU/WebGL walked from Tidewater's authored start to Joe's buyer over generated terrain, opened and closed the fish-buyer and upgrade-shop panels, sold a catch, and purchased an upgrade; WebGPU App activation, gameplay frames, departure, and re-entry: ${JSON.stringify( { worldId, assetId: reference.assetId, biteFrames: webgpu.trace.bite.length, fightFrames: webgpu.trace.fight.length - 1, sale: webgpu.sale, shop: webgpu.shop } )}`;
	result.dataset.status = 'passed';
} catch ( error ) {
	result.textContent = `FAIL ${error.stack || error}`;
	result.dataset.status = 'failed';
} finally {
	for ( const extensions of extensionSets ) extensions.dispose();
	connector?.close();
}
