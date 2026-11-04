import { registerWorldComponentBackendBatchAdapter } from '../../../src/network/WorldComponentBackendRegistry.js';
import { WildlifeSimulation, DEFAULT_WILDLIFE_ENVIRONMENT } from '../../../src/world/wildlife/WildlifeSimulation.js';
import { WebGLWildlifeAdapter } from './WebGLWildlifeAdapter.js';
import { WebGLSwashProbe } from './WebGLSwashProbe.js';

const COMPONENT_TYPE = 'elsemesh.example-island-wildlife/1';

registerWorldComponentBackendBatchAdapter( 'webgl', COMPONENT_TYPE, ( { fallback }, components ) => {

	const componentIDs = components.map( component => component.id );
	let simulation = null, presentation = null, disposed = false;
	const component = components[ 0 ];
	return {
		componentIDs,
		runtimeComponentId: componentIDs[ 0 ],
		runtime: {
			update() {},
			afterPlayerUpdate( dt, camera, player ) {
				if ( disposed ) return;
				const terrain = fallback.worldLink ? fallback.hostedTerrainData : fallback.terrain;
				if ( ! terrain ) return;
				if ( ! simulation ) {
					const shoreField = fallback.shoreField || fallback.hostedTerrainSurface?.shoreField || null;
					simulation = new WildlifeSimulation( {
						terrain,
						colliders: fallback.worldLink ? fallback.app.hostedColliders : fallback.app.worldState.colliders,
						vegetation: { records: fallback.vegetationRecords || {} },
						footprints: component.footprints || [], roofPerches: component.roofPerches || [],
						boat: fallback.boat?.controller || null, boatModel: fallback.boat?.model || null,
						shoreProbe: shoreField ? new WebGLSwashProbe( {
							field: shoreField, terrain, seaLevel: fallback.worldSeaLevel,
							time: () => fallback.animationStartTime ? ( performance.now() - fallback.animationStartTime ) * 0.001 : 0,
						} ) : null,
						query: fallback.waterQuery, seed: component.seed ?? 5,
					} );
					presentation = new WebGLWildlifeAdapter( fallback.THREE, fallback.scene, terrain );
				}
				const sunY = fallback._sunDirection( fallback.app.settings.timeOfDay ).y;
				simulation.update( dt, camera, player, {
					windX: DEFAULT_WILDLIFE_ENVIRONMENT.windX, windZ: DEFAULT_WILDLIFE_ENVIRONMENT.windZ,
					windSpeed: DEFAULT_WILDLIFE_ENVIRONMENT.windSpeed,
					night: fallback.THREE.MathUtils.smoothstep( - sunY, 0.02, 0.18 ), sunY,
					seaLevel: fallback.hostedSeaLevel ?? DEFAULT_WILDLIFE_ENVIRONMENT.seaLevel,
				} );
				presentation.update( simulation, camera );
			},
			dispose() {
				disposed = true;
				presentation?.dispose();
				presentation = null;
				simulation = null;
			},
		},
	};

} );
