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
	for ( let frame = 0; frame < 320 && bite?.phase !== 'take'; frame += 32 ) {
		const batch = Array.from( { length: 32 }, () => runtime.stepBite( 0.1, { habitat, hour: 7 } ) );
		const states = await Promise.all( batch );
		bite = states.at( -1 )?.bite;
	}
	if ( bite?.phase !== 'take' || !behaviorData.fishCatalog[ bite.species ] || !Number.isFinite( bite.kg ) ) throw new Error( `Tidewater fishing module did not produce a valid bite: ${JSON.stringify( bite )}` );
	const startedFight = await runtime.strike( { lineKg: 5, reelSpeed: 3, distance: 20, seed: 246813579 } );
	if ( !startedFight || startedFight.state !== 'fighting' ) throw new Error( `Tidewater fishing module did not start a fight: ${JSON.stringify( startedFight )}` );
	const steppedFight = await runtime.stepFight( 0.1, false, 7 );
	if ( steppedFight.state !== 'fighting' || steppedFight.fight.time !== 0.1 ) throw new Error( `Fishing Worker did not advance gameplay state: ${JSON.stringify( steppedFight )}` );
	result.textContent = `PASS live signed Tidewater fishing module through gateway and dedicated Worker: ${JSON.stringify( { worldId, assetId: reference.assetId, bite: { species: bite.species, kg: bite.kg }, fight: steppedFight.fight } )}`;
	result.dataset.status = 'passed';
} catch ( error ) {
	result.textContent = `FAIL ${error.stack || error}`;
	result.dataset.status = 'failed';
} finally {
	extensions?.dispose();
	connector?.close();
}
