import { WebGLFishStandAdapter } from './webgl/WebGLFishStandAdapter.js';
import { WebGLChandleryAdapter } from './webgl/WebGLChandleryAdapter.js';
import { WebGLGameAdapter } from './webgl/WebGLGameAdapter.js';
import { fishStandColliderVolumes } from './game/FishStandContent.js';
import { Minimap } from './game/Minimap.js';

export const webglBehaviorImplementations = Object.freeze( {
	fishingGame: Object.freeze( {
	onWebGLWorldActivated( { active, data, experience, fallback, mode, THREE } ) {
		if ( ! active ) {

			fallback.gameAdapter?.minimap?.dispose();
			if ( fallback.gameAdapter ) fallback.gameAdapter.minimap = null;
			return;

		}
		const builtIn = mode === 'builtin';
		const terrain = builtIn ? fallback.terrain : fallback.hostedTerrainData || { heightAt: () => Number( fallback.spawn.position[ 1 ] ) - 1.7 };
		const colliders = builtIn ? fallback.app.worldState.colliders : fallback.app.hostedColliders;
		const fishStand = new WebGLFishStandAdapter( THREE, fallback.scene, {
			terrain, colliders, loader: fallback.loader, placement: data.fishStand,
		} );
		const chandlery = new WebGLChandleryAdapter( THREE, fallback.scene, {
			terrain, colliders, loader: fallback.loader, placement: data.chandlery,
		} );
		fallback.fishStand = fishStand;
		fallback.chandlery = chandlery;
		fallback.gameAdapter = new WebGLGameAdapter( fishStand.vendor, {
			vendors: [ fishStand.vendor, chandlery.vendor ], experience,
			...( builtIn ? {} : { worldId: fallback.connector.worldId } ),
			THREE, scene: fallback.scene, camera: fallback.camera, query: fallback.waterQuery, extensions: fallback.activeWorldExtensions,
			terrain, boatController: fallback.boat?.controller || null, boatRoot: fallback.boat?.group || null, audio: fallback.app.audio,
			engineRoot: fallback.app.hud?.root || null, engineUI: fallback.app.hud || null,
		} );
		if ( Number.isInteger( terrain?.res ) && Number.isFinite( terrain.texel ) && Number.isFinite( terrain.origin ) ) {

			const game = fallback.gameAdapter;
			const vendorByID = { joe: fishStand.vendor, marta: chandlery.vendor };
			game.setMinimap( new Minimap( game.ui.hud, {
				terrain,
				fishingAreas: game.fishingAreas,
				state: game.state,
				vendorPosition: id => vendorByID[ id ]?.position || null,
				habitatAtPoint: ( x, z, depth ) => game._habitatAtPoint( x, z, depth ),
			}, { camera: fallback.camera, player: fallback.player, boat: fallback.boat?.controller || null } ) );

		}
		if ( builtIn ) {
			const stand = data.fishStand;
			const y = terrain.heightAt( stand.position[ 0 ], stand.position[ 1 ] );
			for ( const box of fishStandColliderVolumes( y, stand ) ) fallback.blockers.push( {
				centerX: box.center[ 0 ], centerZ: box.center[ 2 ], halfX: box.half[ 0 ], halfZ: box.half[ 2 ], yaw: box.yaw,
				minY: box.center[ 1 ] - box.half[ 1 ], maxY: box.center[ 1 ] + box.half[ 1 ],
			} );
		}
	},
	onWebGLKeyDown( { active, fallback, event } ) {
		return !! active && !! fallback.gameAdapter?.handleKey( event.code );
	},
	onWebGLBlocksPlayerInput( { active, fallback } ) {
		return !! active && !! ( fallback.gameAdapter?.hud.standOpen || fallback.gameAdapter?.hud.invOpen );
	},
	onWebGLWorldFrame( { active, fallback, dt } ) {
		if ( ! active ) return;
		fallback.fishStand?.update( dt, fallback.camera.position );
		fallback.chandlery?.update( dt, fallback.camera.position );
		fallback.gameAdapter?.update( dt, fallback.player || fallback.camera, fallback.input, { timeOfDay: fallback.app.settings.timeOfDay, freeCam: fallback.freeCam } );
	},
	} ),
} );
