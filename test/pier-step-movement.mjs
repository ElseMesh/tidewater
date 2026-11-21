import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as E from '../../../src/engine/index.js';
import { Player } from '../../../src/player/Player.js';
import { Colliders, setMovementSupportKernel } from '../../../src/world/Colliders.js';
import { createMovementSupportKernel } from '../../../src/world/MovementSupportKernel.js';
import { TIDEWATER_LAYOUT } from '../layout.js';
import { TerrainData } from '../terrain/TerrainData.js';
import { tidewaterPierColliders } from './tidewater-pier-colliders.js';

const source = JSON.parse( await readFile( new URL( '../world-source.json', import.meta.url ) ) );
const terrain = new TerrainData( { worldLayout: TIDEWATER_LAYOUT } );
const kernels = [ [ 'JavaScript', null ] ];
try {
	const wasm = await readFile( new URL( '../../../native/movement/elsemesh_movement.wasm', import.meta.url ) );
	kernels.push( [ 'WebAssembly', await createMovementSupportKernel( wasm ) ] );
} catch ( error ) {
	if ( error.code !== 'ENOENT' ) throw error;
}

for ( const [ kernelName, kernel ] of kernels ) {
	setMovementSupportKernel( kernel );
	for ( const mode of [ 'built-in', 'hosted' ] ) {
		const colliders = tidewaterPierColliders( terrain );
		const input = {
			moveAxes: () => ( { x: 0, y: 1, sprint: 0 } ),
			consumeLook: () => ( { x: 0, y: 0 } ),
			down: () => false,
			hit: () => false,
		};
		const player = new Player( {
			camera: new E.PerspectiveCamera( 60, 1, 0.1, 1000 ), input, terrain, colliders,
			query: { allocate: () => 0, setPoint() {}, cpuValid: false }, boat: null, worldLayout: TIDEWATER_LAYOUT,
		} );
		player.setWorldRules( source.rules, { avatarProfileId: 'elsemesh.avatar.stock-male/1' } );
		player.yaw = TIDEWATER_LAYOUT.start.yaw;
		player.grounded = true;
		player.hostedCollisionGuard = null;

		for ( let frame = 0; frame < 360; frame ++ ) {
			if ( mode === 'hosted' ) player.updateHostedWorld( 1 / 60 );
			else player.updateWalk( 1 / 60 );
		}

		assert.ok( player.position.z > - 60, `${kernelName} ${mode} movement climbs the authored beach steps and reaches the wooden harbor deck` );
		assert.ok( Math.abs( player.position.y - TIDEWATER_LAYOUT.pier.deckHeight ) < 1e-6, `${kernelName} ${mode} movement stands on the authored deck height` );
	}
}
setMovementSupportKernel( null );

console.log( `Tidewater pier steps: built-in and hosted movement reach the deck with ${kernels.map( ( [ name ] ) => name ).join( ' and ' )} collision support` );
