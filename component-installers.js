import { Vegetation } from './renderers/WebGPUVegetation.js';
import { Reef } from './Reef.js';
import { TIDEWATER_LAYOUT } from './layout.js';
import { Wildlife } from './wildlife/Wildlife.js';
import { Whale } from './marine/Whale.js';
import { worldComponentDescriptor } from '../../src/network/WorldComponentRegistry.js';
import { HostedBoat } from '../../src/network/HostedBoat.js';
import { decodeWorldComponentAsset } from '../../src/network/WorldComponentAssetCodecRegistry.js';
import { decodeReefPlacements, MAX_REEF_PLACEMENTS, REEF_PLACEMENT_HEADER_BYTES, REEF_PLACEMENT_RECORD_BYTES } from './ReefPlacements.js';

const INSTALLERS = new Map( [
	[ 'elsemesh.static-vegetation/1', installVegetation ],
	[ 'elsemesh.example-island-wildlife/1', installWildlife ],
	[ 'elsemesh.static-reef/1', installReef ],
	[ 'elsemesh.humpback-whale/1', installWhale ],
	[ 'elsemesh.downeast-boat/1', installBoat ],
] );

export function tidewaterComponentInstaller( type ) {
	return INSTALLERS.get( type ) || null;
}

async function installVegetation( { root, connector, installed }, component ) {
	const placementRecords = component.placementAssetId ? readVegetationPlacements( connector, component ) : null;
	const terrain = root.userData.terrainData;
	installed.push( new Vegetation( { scene: root, terrain, village: null, worldLayout: TIDEWATER_LAYOUT, placementRecords } ) );
	return true;
}

async function installWildlife( { app, root, installed }, component ) {
	const terrain = root.userData.terrainData;
	if ( ! terrain ) throw new Error( `Wildlife component ${component.id} requires the packaged terrain surface to install first` );
	const vegetation = [ ...( root.userData.worldComponents || [] ), ...installed ].find( runtime => runtime.records?.palms ) || null;
	const wildlife = new Wildlife( {
		scene: root, renderer: app.renderer, terrain, footprints: component.footprints, roofPerches: component.roofPerches,
		colliders: app.hostedColliders, vegetation, query: app.hostedQuery, spray: app.spray, csm: app.csm, seed: component.seed,
	} );
	installed.push( {
		wildlife: true, wildlifeRuntime: wildlife,
		update: ( dt, camera, player ) => wildlife.update( dt, camera, player ),
		dispose: () => wildlife.dispose(),
	} );
	return true;
}

async function installReef( { app, root, connector, installed }, component ) {
	const { records } = readReefPlacements( connector, component );
	let reef = root.userData.staticReef;
	if ( reef ) reef.appendPlacements( records );
	else {
		reef = new Reef( { scene: root, terrain: null, worldLayout: TIDEWATER_LAYOUT, placementRecords: records, maxInstances: reefPlacementCapacity( connector ) } );
		reef.setOcean( app.fft );
		root.userData.staticReef = reef;
		installed.push( {
			reef: true,
			update: ( dt, camera ) => reef.update( dt, camera?.position ),
			dispose: () => { if ( root.userData.staticReef === reef ) delete root.userData.staticReef; reef.dispose(); },
		} );
	}
	return true;
}

async function installWhale( { app, root, connector, installed }, component ) {
	const whale = new Whale( {
		scene: root, terrain: root.userData.terrainData || null,
		seaLevel: connector.manifest.rules.seaLevel ?? 0,
		createBrain: worldComponentDescriptor( component.type )?.createSimulation,
		profile: { seed: component.seed, route: component.route, surfaceAt: component.surfaceAt, cruiseSpeed: component.cruiseSpeed, surfaceSpeed: component.surfaceSpeed },
	} );
	try {
		await whale.loadPackage( {
			manifest: connector.assets.get( component.modelAssetId ),
			geometry: connector.assets.get( component.geometryAssetId ),
			albedo: connector.assets.get( component.albedoAssetId ),
			height: connector.assets.get( component.heightAssetId ),
		} );
	} catch ( error ) { whale.dispose(); throw error; }
	installed.push( { whale: true, whaleInstance: whale, update: ( dt, camera ) => whale.update( dt, camera ), dispose: () => whale.dispose() } );
	return true;
}

async function installBoat( { root, connector, installed }, component ) {
	const object = connector.manifest.objects.find( candidate => candidate.id === component.objectId );
	if ( ! object ) throw new Error( `Boat component ${component.id} has no berth object` );
	const boat = new HostedBoat( { root, component, object } );
	installed.push( {
		hostedBoat: true, boat,
		activate: context => boat.activate( context ),
		deactivate: () => boat.deactivate(),
		update: dt => boat.update( dt ),
		dispose: () => boat.dispose(),
	} );
	return true;
}

function readVegetationPlacements( connector, component ) {
	const bytes = connector.assets.get( component.placementAssetId );
	if ( ! bytes ) throw new Error( `Vegetation component ${component.id} is missing its placement asset` );
	return decodeWorldComponentAsset( 'vegetation-placement/1', bytes, component.seed );
}

function readReefPlacements( connector, component ) {
	const bytes = connector.assets.get( component.placementAssetId );
	if ( ! bytes ) throw new Error( `Reef component ${component.id} is missing its placement asset` );
	return decodeReefPlacements( bytes );
}

function reefPlacementCapacity( connector ) {
	const assets = new Map( connector.manifest.assets.map( asset => [ asset.id, asset ] ) );
	let capacity = 0;
	for ( const component of connector.manifest.components || [] ) {
		if ( component.type !== 'elsemesh.static-reef/1' ) continue;
		const asset = assets.get( component.placementAssetId );
		if ( ! asset || ! Number.isSafeInteger( asset.bytes ) || asset.bytes < REEF_PLACEMENT_HEADER_BYTES || ( asset.bytes - REEF_PLACEMENT_HEADER_BYTES ) % REEF_PLACEMENT_RECORD_BYTES !== 0 ) throw new Error( `Reef component ${component.id} has an invalid placement asset size` );
		capacity += ( asset.bytes - REEF_PLACEMENT_HEADER_BYTES ) / REEF_PLACEMENT_RECORD_BYTES;
		if ( capacity > MAX_REEF_PLACEMENTS ) throw new Error( 'World reef placements exceed the supported instance capacity' );
	}
	return Math.max( 1, capacity );
}
