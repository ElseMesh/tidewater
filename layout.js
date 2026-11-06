import { ISLAND_DEFINITION } from './IslandDefinition.js';
import * as THREE from '../../src/engine/math/index.js';

const definition = ISLAND_DEFINITION;

export const TIDEWATER_LAYOUT = Object.freeze( {
	terrainSize: definition.terrainSize,
	terrainRes: definition.terrainRes,
	beach: Object.freeze( { ...definition.beach } ),
	pier: Object.freeze( { ...definition.pier } ),
	boatDock: Object.freeze( { position: new THREE.Vector3( ...definition.boatDock.position ), heading: definition.boatDock.heading } ),
	village: Object.freeze( { center: new THREE.Vector3( ...definition.village.center ), radius: definition.village.radius } ),
	reef: Object.freeze( { center: new THREE.Vector3( ...definition.reef.center ), radius: definition.reef.radius } ),
	spawn: Object.freeze( { position: new THREE.Vector3( ...definition.spawn.position ), yaw: definition.spawn.yaw } ),
	start: Object.freeze( { position: new THREE.Vector3( ...definition.start.position ), yaw: definition.start.yaw } ),
	swellDir: new THREE.Vector2( ...definition.swellDir ).normalize(),
	vegetation: Object.freeze( {
		bay: Object.freeze( { ...definition.vegetation.bay } ),
		protectedPaths: definition.vegetation.protectedPaths.map( path => Object.freeze( { points: path.points.map( point => Object.freeze( [ ...point ] ) ) } ) ),
		fallbackPaths: definition.vegetation.fallbackPaths.map( path => Object.freeze( { width: path.width, points: path.points.map( point => Object.freeze( [ ...point ] ) ) } ) ),
	} ),
} );
