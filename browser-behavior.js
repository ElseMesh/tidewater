import { Game } from './game/Game.js';
import { ShoreWaves } from '../../src/ocean/ShoreWaves.js';
import { Color, Vector3 } from '../../src/engine/math/index.js';

const litWorlds = new WeakMap();

export function installFishingVenueLights( app, worldId, data ) {
	if ( ! app?.localLights || ! app?.terrainData ) return;
	let installed = litWorlds.get( app );
	if ( ! installed ) litWorlds.set( app, installed = new Set() );
	if ( installed.has( worldId ) ) return;
	const venues = [
		[ data?.fishStand, - 0.9, 1.85, 0.1 ],
		[ data?.chandlery, - 0.75, 1.58, - 1.45 ],
	];
	for ( const [ venue, lx, ly, lz ] of venues ) {
		if ( ! venue?.position || ! Number.isFinite( venue.yaw ) ) continue;
		const [ x, z ] = venue.position;
		if ( ! Number.isFinite( x ) || ! Number.isFinite( z ) ) continue;
		const c = Math.cos( venue.yaw ), s = Math.sin( venue.yaw );
		app.localLights.add( {
			position: new Vector3( x + lx * c + lz * s, app.terrainData.heightAt( x, z ) + ly, z - lx * s + lz * c ),
			color: new Color( 1.0, 0.72, 0.42 ), intensity: 5 * 1.5, range: 11, kind: 'lantern', flicker: 0.08,
		} );
	}
	installed.add( worldId );
}

export const browserBehaviorImplementations = Object.freeze( {
	shoreAwareBoat: Object.freeze( {
	onHostedWorldActivated( { app, terrain, active } ) {
		if ( ! active || ! terrain ) return;
		// The boat's hosted hydrostatics use the destination terrain and shore model.
		terrain.shore ||= new ShoreWaves( terrain.terrainGPU );
		if ( terrain.terrain && app.terrain.wetness ) {
			terrain.terrain.wetness = app.terrain.wetness;
			terrain.terrain.finalizeMaterial();
		}
		app.hostedWaterSurface.terrain = terrain.terrainGPU;
		app.hostedWaterSurface.shore = terrain.shore;
	},
	} ),

	fishingGame: Object.freeze( {
	onBuiltinWorldActivated( { app, experience, worldId, extensions, data, active } ) {
		if ( ! active ) return;
		installFishingVenueLights( app, worldId, data );
		let game = app.worldGames.get( worldId );
		if ( ! game ) {
			game = new Game( app, { query: app.query, terrain: app.terrainData, colliders: app.colliders, boatController: app.boatCtl, experience, worldId, extensions } );
			app.worldGames.set( worldId, game );
		}
		app.game = game;
		game.setWorldActive( true );
	},
	onHostedWorldActivated( { app, connector, root, active, extensions } ) {
		if ( ! active ) {
			app.game?.setWorldActive( false );
			return;
		}
		const worldTerrain = root.userData.terrainData || app.terrainData;
		let game = app.worldGames.get( connector.worldId );
		if ( ! game ) {
			game = new Game( app, { query: app.hostedQuery, terrain: worldTerrain, colliders: app.hostedColliders, boatController: app.player.boat || app.boatCtl, experience: connector.manifest.experience, worldId: connector.worldId, extensions } );
			app.worldGames.set( connector.worldId, game );
		}
		app.game = game;
		game.setWorldContext( { query: app.hostedQuery, terrain: worldTerrain, colliders: app.hostedColliders, boatController: app.player.boat || app.boatCtl } );
		game.setWorldActive( true );
	},
	onWorldDeactivated( { app, mode } ) {
		if ( ! app.game ) return;
		if ( mode === 'hosted' ) app.game.setWorldContext( { query: app.query, terrain: app.terrainData, colliders: app.colliders, boatController: app.boatCtl } );
		app.game.setWorldActive( false );
	},
	onWorldFrame( { app, active, dt } ) {
		if ( active && app.game?.active ) app.game.update( dt );
	},
	} ),
} );
