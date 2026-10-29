import { FishingGameRuntime } from './FishingGameRuntime.js';
import { isFishCatalog } from './FishTable.js';
import { createWebGLShoreSurfaceOffset } from './webgl-shore-surface.js';
import { registerWorldBehavior, registerWorldBehaviorImplementation } from '../../src/network/WorldBehaviorRegistry.js';

registerWorldBehavior( 'elsemesh.fishing-game/1', {
	validateExperienceData: ( data, hasExtension ) => {
		if ( ! hasExtension ) throw new Error( 'Fishing behavior requires a signed JavaScript extension' );
		if ( ! isFishCatalog( data.fishCatalog ) ) throw new Error( 'Fishing behavior requires a valid world-authored fish catalog' );
		for ( const name of [ 'fishStand', 'chandlery' ] ) {
			const location = data[ name ];
			if ( location === undefined ) continue;
			if ( ! location || typeof location !== 'object' || Array.isArray( location ) || Object.keys( location ).some( key => ! [ 'position', 'yaw', 'interactionRadius' ].includes( key ) ) || ! Array.isArray( location.position ) || location.position.length !== 2 || location.position.some( value => ! Number.isFinite( value ) || Math.abs( value ) > 1000000 ) || ! Number.isFinite( location.yaw ) || Math.abs( location.yaw ) > 360 || ! Number.isFinite( location.interactionRadius ) || location.interactionRadius < 0.5 || location.interactionRadius > 20 ) throw new Error( `Invalid ThruHold fishing location ${name}` );
		}
	},
	createRuntime: options => {
		const runtime = new FishingGameRuntime( options );
		if ( options.extensions?.has?.( 'elsemesh.fishing-game/1' ) ) {
			runtime.extensionReady = options.extensions.ready( 'elsemesh.fishing-game/1' ).then( () => runtime );
			runtime.extensionReady.catch( () => {} );
		}
		return runtime;
	},
} );

registerWorldBehavior( 'elsemesh.shore-aware-boat/1', {
	validateExperienceData: data => {
		if ( Object.keys( data ).length ) throw new Error( 'Invalid shore-aware boat data' );
	},
} );

registerWorldBehaviorImplementation( 'elsemesh.shore-aware-boat/1', {
	onWebGLWorldActivated( { active, fallback, mode } ) {
		if ( ! active || ! fallback.waterQuery ) return;
		const terrain = mode === 'builtin' ? fallback.terrain : fallback.hostedTerrainData;
		fallback.waterQuery.setSurfaceOffsetSampler( createWebGLShoreSurfaceOffset( {
			terrain, seaLevel: fallback.worldSeaLevel, field: fallback.shoreField,
		} ) );
	},
} );
