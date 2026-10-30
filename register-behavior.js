import { FishingGameRuntime } from './FishingGameRuntime.js';
import { isFishCatalog } from './FishTable.js';
import { createWebGLShoreSurfaceOffset } from './webgl-shore-surface.js';
import { registerWorldBehavior, registerWorldBehaviorImplementation } from '../../src/network/WorldBehaviorRegistry.js';
import { browserBehaviorImplementations } from './browser-behavior.js';
import { webglBehaviorImplementations } from './webgl-behavior.js';
import * as fishPresentation from './FishPresentation.js';
import { registerWorldFishPresentation } from '../../src/network/WorldFishPresentation.js';
import './register-components.js';

function validFishingAreas( areas ) {

	const isRecord = value => value && typeof value === 'object' && ! Array.isArray( value );
	if ( ! isRecord( areas ) || Object.keys( areas ).some( key => ! [ 'pier', 'reef' ].includes( key ) ) ) return false;
	const { pier, reef } = areas;
	if ( ! isRecord( pier ) || Object.keys( pier ).sort().join( ',' ) !== 'headDepth,headWidth,width,x,zEnd,zStart' ) return false;
	if ( ! [ pier.x, pier.zStart, pier.zEnd, pier.width, pier.headWidth, pier.headDepth ].every( value => Number.isFinite( value ) && Math.abs( value ) <= 1000000 ) || pier.zEnd <= pier.zStart || pier.width <= 0 || pier.headWidth <= 0 || pier.headDepth <= 0 ) return false;
	if ( ! isRecord( reef ) || Object.keys( reef ).sort().join( ',' ) !== 'center,radius' || ! Array.isArray( reef.center ) || reef.center.length !== 2 ) return false;
	return reef.center.every( value => Number.isFinite( value ) && Math.abs( value ) <= 1000000 ) && Number.isFinite( reef.radius ) && reef.radius > 0 && reef.radius <= 1000000;

}

registerWorldBehavior( 'elsemesh.fishing-game/1', {
	validateExperienceData: ( data, hasExtension ) => {
		if ( ! hasExtension ) throw new Error( 'Fishing behavior requires a signed JavaScript extension' );
		if ( ! isFishCatalog( data.fishCatalog ) ) throw new Error( 'Fishing behavior requires a valid world-authored fish catalog' );
		for ( const name of [ 'fishStand', 'chandlery' ] ) {
			const location = data[ name ];
			if ( ! location || typeof location !== 'object' || Array.isArray( location ) || Object.keys( location ).some( key => ! [ 'position', 'yaw', 'interactionRadius' ].includes( key ) ) || ! Array.isArray( location.position ) || location.position.length !== 2 || location.position.some( value => ! Number.isFinite( value ) || Math.abs( value ) > 1000000 ) || ! Number.isFinite( location.yaw ) || Math.abs( location.yaw ) > 360 || ! Number.isFinite( location.interactionRadius ) || location.interactionRadius < 0.5 || location.interactionRadius > 20 ) throw new Error( `Invalid ThruHold fishing location ${name}` );
		}
		if ( ! validFishingAreas( data.fishingAreas ) ) throw new Error( 'Invalid Tidewater fishing areas' );
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

registerWorldFishPresentation( 'elsemesh.fishing-game/1', fishPresentation );

registerWorldBehavior( 'elsemesh.shore-aware-boat/1', {
	validateExperienceData: data => {
		if ( Object.keys( data ).length ) throw new Error( 'Invalid shore-aware boat data' );
	},
} );

registerWorldBehaviorImplementation( 'elsemesh.shore-aware-boat/1', {
	onWebGLWorldActivated( { active, fallback, mode } ) {
		if ( ! active || ! fallback.waterQuery ) return;
		const terrain = mode === 'builtin' ? fallback.terrain : fallback.hostedTerrainData;
		const shoreField = mode === 'builtin' ? fallback.shoreField : fallback.hostedTerrainSurface?.shoreField;
		fallback.waterQuery.setSurfaceOffsetSampler( createWebGLShoreSurfaceOffset( {
			terrain, seaLevel: fallback.worldSeaLevel, field: shoreField,
		} ) );
	},
} );

registerWorldBehaviorImplementation( 'elsemesh.shore-aware-boat/1', browserBehaviorImplementations.shoreAwareBoat );
registerWorldBehaviorImplementation( 'elsemesh.fishing-game/1', browserBehaviorImplementations.fishingGame );
registerWorldBehaviorImplementation( 'elsemesh.fishing-game/1', webglBehaviorImplementations.fishingGame );
