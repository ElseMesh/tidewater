import { worldComponentDescriptor } from '../../../src/network/WorldComponentRegistry.js';
import { registerWorldComponentBackendAdapter } from '../../../src/network/WorldComponentBackendRegistry.js';
import { Whale } from '../marine/Whale.js';

const COMPONENT_TYPE = 'elsemesh.humpback-whale/1';
registerWorldComponentBackendAdapter( 'webgl', COMPONENT_TYPE, installWhale );

async function installWhale( { fallback, manifest, assets, terrain, rules }, component ) {

	const assetIDs = [ component.modelAssetId, component.geometryAssetId, component.albedoAssetId, component.heightAssetId ];
	const [ model, geometry, albedo, height ] = assetIDs.map( id => id ? assets.get( id ) : null );
	if ( [ model, geometry, albedo, height ].some( asset => ! asset ) ) throw new Error( `Whale component ${ component.id } is missing a signed model asset` );
	const createBrain = worldComponentDescriptor( component.type )?.createSimulation;
	if ( typeof createBrain !== 'function' ) throw new Error( `Whale component ${ component.id } has no registered Tidewater simulation` );
	const whale = new Whale( {
		THREE: fallback.THREE, webgl: true, scene: fallback.scene,
		terrain: terrain || fallback.hostedTerrainData || null,
		query: fallback.waterQuery, spray: fallback.spray, queryName: `whale:${ component.id }`,
		seaLevel: rules?.seaLevel ?? manifest?.rules?.seaLevel ?? 0,
		profile: {
			seed: component.seed, route: component.route, surfaceAt: component.surfaceAt,
			cruiseSpeed: component.cruiseSpeed, surfaceSpeed: component.surfaceSpeed,
		},
		createBrain,
	} );
	try {
		await whale.loadPackage( { manifest: model, geometry, albedo, height } );
	} catch ( error ) {
		whale.dispose();
		throw error;
	}
	return {
		installed: true,
		runtime: {
			update: ( dt, camera ) => whale.update( dt, camera ),
			dispose: () => whale.dispose(),
		},
	};

}
