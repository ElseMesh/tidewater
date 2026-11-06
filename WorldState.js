import { TerrainData } from './terrain/TerrainData.js';
import { Colliders } from '../../src/world/Colliders.js';
import { TIDEWATER_LAYOUT } from './layout.js';

// Backend-neutral state shared by the built-in island's gameplay and its
// presentation adapters. Render objects and GPU resources belong elsewhere.
export class WorldState {

	constructor( { terrainSeed = 7, worldLayout = TIDEWATER_LAYOUT } = {} ) {

		this.terrain = new TerrainData( { seed: terrainSeed, worldLayout } );
		this.colliders = new Colliders();

	}

}
