import { WorldConnector } from '../../../src/network/WorldConnector.js';
import { createWorldBehaviorExtensions, createWorldBehaviorRuntime } from '../../../src/network/WorldBehaviorRegistry.js';
import { GameState } from '../GameState.js';
import '../register-behavior.js';

const result = document.querySelector( '#result' );
const query = new URLSearchParams( location.search );
const behaviorId = 'elsemesh.fishing-game/1';
let connector;
let extensions;
let runtime;

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
	const assets = new Map( [ [ reference.assetId, moduleBytes ] ] );
	extensions = createWorldBehaviorExtensions( experience, assets );
	runtime = createWorldBehaviorRuntime( experience, behaviorId, {
		state: new GameState( undefined, worldId, behaviorData.fishCatalog ), load: false, worldId, extensions,
	} );
	await runtime.extensionReady;
	const habitat = { pier: 1, shallows: 1, reef: 0, bay: 0, deep: 0 };
	const started = await runtime.startBite( habitat, 7, 123456789 );
	if ( !started || started.phase !== 'wait' ) throw new Error( `Fishing Worker did not initialize bite state: ${JSON.stringify( started )}` );
	let bite = started;
	let biteFrames = 0;
	while ( bite?.phase !== 'take' && biteFrames < 1200 ) {
		for ( let step = 0; step < 8 && bite?.phase !== 'take'; step ++ ) {
			bite = ( await runtime.stepBite( 0.1, { habitat, hour: 7 } ) ).bite;
			biteFrames ++;
		}
	}
	if ( bite?.phase !== 'take' || !behaviorData.fishCatalog[ bite.species ] || !Number.isFinite( bite.kg ) ) throw new Error( `Tidewater fishing module did not produce a valid bite: ${JSON.stringify( bite )}` );
	const startedFight = await runtime.strike( { lineKg: 5, reelSpeed: 3, distance: 20, seed: 246813579 } );
	if ( !startedFight || startedFight.state !== 'fighting' ) throw new Error( `Tidewater fishing module did not start a fight: ${JSON.stringify( startedFight )}` );
	let fightResult = null, fightFrames = 0;
	while ( fightFrames < 60 * 180 && runtime.fight ) {
		const fight = runtime.fight;
		const reeling = fight.tension < 0.68 && fight.surge < 0.6;
		fightResult = await runtime.stepFight( 1 / 60, reeling, 7 );
		fightFrames ++;
	}
	if ( fightResult?.state !== 'caught' || runtime.fight || runtime.state.inventory.length !== 1 ) throw new Error( `Fishing Worker did not complete the catch: ${JSON.stringify( { state: fightResult?.state, inventory: runtime.state.inventory } )}` );
	const sale = runtime.state.sell();
	if ( sale.count !== 1 || runtime.state.inventory.length !== 0 || runtime.state.money !== sale.total ) throw new Error( `Fishing Worker catch could not complete sale: ${JSON.stringify( { sale, money: runtime.state.money, inventory: runtime.state.inventory } )}` );
	result.textContent = `PASS live signed Tidewater fishing module through gateway and dedicated Worker: ${JSON.stringify( { worldId, assetId: reference.assetId, biteFrames, bite: { species: bite.species, kg: bite.kg }, fightFrames, outcome: fightResult.state, sale } )}`;
	result.dataset.status = 'passed';
} catch ( error ) {
	result.textContent = `FAIL ${error.stack || error}`;
	result.dataset.status = 'failed';
} finally {
	extensions?.dispose();
	connector?.close();
}
