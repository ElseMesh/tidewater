import { Mesh } from '../../src/engine/scene/Mesh.js';
import { CDLOD } from '../../src/core/CDLOD.js';
import { LAYERS } from '../../src/core/SceneRenderer.js';
import { HeightfieldTerrainData } from '../../src/world/HeightfieldTerrainData.js';
import { TerrainGPU } from '../../src/world/TerrainGPU.js';
import { Terrain } from '../../src/world/Terrain.js';
import { Vegetation } from '../../src/world/Vegetation.js';
import { Reef } from '../../src/world/Reef.js';
import { Wildlife } from '../../src/world/wildlife/Wildlife.js';
import { Whale } from '../../src/world/marine/Whale.js';
import { HostedBoat } from '../../src/network/HostedBoat.js';
import { decodeVegetationPlacements } from '../../src/network/VegetationPlacements.js';
import { decodeGrassDensityAsset } from '../../src/network/GrassDensityAsset.js';
import { decodeTerrainSurfaceAsset } from '../../src/network/TerrainSurfaceAsset.js';
import { decodeReefPlacements, MAX_REEF_PLACEMENTS, REEF_PLACEMENT_HEADER_BYTES, REEF_PLACEMENT_RECORD_BYTES } from '../../src/network/ReefPlacements.js';

const INSTALLERS = new Map( [
	[ 'elsemesh.procedural-island-vegetation/1', installVegetation ],
	[ 'elsemesh.static-vegetation/1', installVegetation ],
	[ 'elsemesh.terrain-surface/1', installTerrainSurface ],
	[ 'elsemesh.example-island-wildlife/1', installWildlife ],
	[ 'elsemesh.procedural-island-terrain/1', installProceduralTerrain ],
	[ 'elsemesh.static-reef/1', installReef ],
	[ 'elsemesh.humpback-whale/1', installWhale ],
	[ 'elsemesh.island-ocean/1', installIslandOcean ],
	[ 'elsemesh.village-materials/2', installVillageMaterials ],
	[ 'elsemesh.downeast-boat/1', installBoat ],
] );

export function tidewaterComponentInstaller( type ) {
	return INSTALLERS.get( type ) || null;
}

async function installVegetation( { app, root, connector, installed }, component ) {
	const placementRecords = component.placementAssetId ? readVegetationPlacements( connector, component ) : null;
	const staticVegetation = component.type === 'elsemesh.static-vegetation/1';
	const grassMask = component.grassMaskAssetId ? decodeGrassDensityAsset( connector.assets.get( component.grassMaskAssetId ) ) : null;
	const grassTerrain = staticVegetation ? root.userData.terrainData : app.terrainData;
	if ( grassMask && ! grassTerrain ) return false;
	if ( grassMask && ( grassMask.size !== grassTerrain.size || grassMask.origin !== grassTerrain.origin ) ) throw new Error( `Static vegetation component ${component.id} grass mask does not match its terrain surface` );
	if ( ! staticVegetation && ! app.remoteWorldActive && app.vegetation && app.vegetation.group.parent !== root && ( ! placementRecords || sameVegetationPlacements( app.vegetation.records, placementRecords ) ) ) {
		root.add( app.vegetation.group );
		installed.push( app.vegetation );
	} else {
		installed.push( new Vegetation( { scene: root, terrain: staticVegetation ? grassTerrain : app.terrainData, village: staticVegetation ? null : app.village, includeGrass: staticVegetation ? !! grassMask : true, grassMask, placementRecords } ) );
	}
	return true;
}

async function installTerrainSurface( { app, root, connector, installed }, component ) {
	const fallback = root.children.find( child => child.userData.worldObjectId === component.objectId );
	const replacedObjects = root.userData.worldPackage?.replacedByComponents || ( root.userData.worldPackage.replacedByComponents = new Set() );
	replacedObjects.add( component.objectId );
	const maps = await decodeTerrainSurfaceAsset( connector.assets.get( component.dataAssetId ) );
	const terrainData = new HeightfieldTerrainData( maps );
	root.userData.terrainData = terrainData;
	const surfaceMaps = { normal: maps.normal, splat: maps.splat, detailWidth: maps.detailWidth, detailHeight: maps.detailHeight, detail: maps.detail };
	const terrainGPU = new TerrainGPU( terrainData, null, surfaceMaps );
	const terrain = new Terrain( { scene: root, terrainData, terrainGPU } );
	if ( fallback ) fallback.visible = false;
	installed.push( {
		islandTerrain: true, terrain, terrainGPU,
		update: ( _dt, camera ) => terrain.update( camera, true ),
		dispose: () => { replacedObjects.delete( component.objectId ); root.remove( terrain.mesh ); terrain.mesh.geometry.dispose(); terrain.mesh.material.dispose(); terrainGPU.dispose(); if ( fallback ) fallback.visible = true; },
	} );
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

async function installProceduralTerrain( { app, root, installed }, component ) {
	const fallback = root.children.find( child => child.userData.worldObjectId === component.objectId );
	const replacedObjects = root.userData.worldPackage?.replacedByComponents || ( root.userData.worldPackage.replacedByComponents = new Set() );
	replacedObjects.add( component.objectId );
	const terrain = new Terrain( { scene: root, terrainData: app.terrainData, terrainGPU: app.terrainGPU } );
	if ( fallback ) fallback.visible = false;
	installed.push( {
		islandTerrain: true,
		update: ( _dt, camera ) => terrain.update( camera, false ),
		dispose: () => { replacedObjects.delete( component.objectId ); root.remove( terrain.mesh ); terrain.mesh.geometry.dispose(); terrain.mesh.material.dispose(); if ( fallback ) fallback.visible = true; },
	} );
	return true;
}

async function installReef( { app, root, connector, installed }, component ) {
	const { records } = readReefPlacements( connector, component );
	let reef = root.userData.staticReef;
	if ( reef ) reef.appendPlacements( records );
	else {
		reef = new Reef( { scene: root, terrain: null, placementRecords: records, maxInstances: reefPlacementCapacity( connector ) } );
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

async function installIslandOcean( { app, root, installed } ) {
	const lod = new CDLOD( { gridSize: Number( app.qs.get( 'G' ) || 32 ), leafSize: 8, levels: 12, minY: -25, maxY: 25 } );
	const mesh = new Mesh( lod.geometry, app.waterMaterial );
	mesh.frustumCulled = false;
	mesh.receiveShadow = true;
	mesh.layers.set( LAYERS.WATER );
	root.add( mesh );
	installed.push( { islandOcean: true, isWorldOcean: true, surface: app.surface, update: ( _dt, camera ) => lod.update( camera ), dispose: () => { root.remove( mesh ); lod.geometry.dispose(); } } );
	return true;
}

async function installVillageMaterials() {
	// WorldPackage loads these maps only when the associated village object is needed.
	return { installed: true, runtime: { dispose() {} } };
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
	return decodeVegetationPlacements( bytes, component.seed );
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

function sameVegetationPlacements( left, right ) {
	for ( const key of Object.keys( left ) ) {
		const a = left[ key ], b = right[ key ];
		if ( Array.isArray( a ) ) {
			if ( ! Array.isArray( b ) || a.length !== b.length ) return false;
			for ( let index = 0; index < a.length; index ++ ) {
				const aRecord = a[ index ], bRecord = b[ index ], keys = Object.keys( aRecord );
				if ( ! bRecord || keys.length !== Object.keys( bRecord ).length || keys.some( field => ! Object.hasOwn( bRecord, field ) || Math.fround( aRecord[ field ] ) !== Math.fround( bRecord[ field ] ) ) ) return false;
			}
		} else if ( a !== b ) return false;
	}
	return true;
}
