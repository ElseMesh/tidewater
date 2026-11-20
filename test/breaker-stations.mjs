import assert from 'node:assert/strict';
import { buildTidewaterBreakerStations } from '../BreakerStations.js';

const terrain = { heightAt: ( _x, z ) => z < - 50 ? 2 : - 2 };
const stations = buildTidewaterBreakerStations( terrain );
const repeated = buildTidewaterBreakerStations( terrain );

assert.equal( stations.spacing, 0.6 );
assert.ok( stations.count > 600 && stations.count < 640, 'the continuous authored coast produces a dense ordered station set' );
assert.deepEqual( stations, repeated, 'same terrain and authored settings produce byte-identical records' );
for ( let index = 0; index < stations.count; index ++ ) {
	const offset = index * 4;
	assert.ok( Number.isFinite( stations.data[ offset ] ) && Number.isFinite( stations.data[ offset + 1 ] ) );
	assert.ok( Math.abs( Math.hypot( stations.data[ offset + 2 ], stations.data[ offset + 3 ] ) - 1 ) < 1e-6, 'every authored sea direction is normalized' );
	if ( index ) assert.ok( stations.data[ offset ] > stations.data[ offset - 4 ], 'station order follows the coast' );
}

console.log( `Tidewater breaker station export passed (${stations.count} deterministic positions)` );
