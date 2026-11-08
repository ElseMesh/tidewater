import { Vector3 } from '../../src/engine/math/Vector3.js';
import { pierWalkableHeightAt } from './PierSurface.js';

// Built-in WebGL uses the packaged village mesh, so its authored pier collision
// volumes are installed here from the same Tidewater layout as the WebGPU pier.
export function installPierGameplayColliders( { colliders, terrain, worldLayout } = {} ) {

	if ( ! colliders?.addBox || typeof terrain?.heightAt !== 'function' || ! worldLayout?.pier ) throw new Error( 'Tidewater pier colliders require colliders, terrain, and the authored pier layout' );
	const P = worldLayout.pier, y = P.deckHeight;
	const box = ( x, cy, z, hx, hy, hz, tag, options = {} ) => colliders.addBox( new Vector3( x, cy, z ), new Vector3( hx, hy, hz ), 0, { tag, ...options } );
	const stepGround = terrain.heightAt( P.x, P.zStart - 0.7 ), nSteps = Math.max( 2, Math.ceil( Math.max( 0, y - stepGround ) / 0.22 ) ), tread = 0.32;
	for ( let k = 1; k < nSteps; k ++ ) {
		const zc = P.zStart - ( k - 0.5 ) * tread, top = pierWalkableHeightAt( P.x, zc, ( px, pz ) => terrain.heightAt( px, pz ), worldLayout ), gb = terrain.heightAt( P.x, zc );
		box( P.x, ( top + gb - 0.4 ) * 0.5, zc, P.width * 0.5, ( top - gb + 0.4 ) * 0.5, tread * 0.5 + 0.005, 'pierStep', { walkable: true } );
	}
	// Walkable pier deck and T-head.
	box( P.x, y - 0.04, ( P.zStart + P.zEnd ) * 0.5, P.width * 0.5, 0.04, ( P.zEnd - P.zStart ) * 0.5, 'pierDeck', { walkable: true } );
	box( P.x, y - 0.04, P.zEnd - P.headDepth * 0.5, P.headWidth * 0.5, 0.04, P.headDepth * 0.5, 'pierDeck', { walkable: true } );
	// The ladder sits on the outer (+X) T-head edge. Its rungs are walkable,
	// non-solid stepping surfaces for the shared swimmer.
	const ladderX = P.x + P.headWidth * 0.5 + 0.07, ladderZ = 35.1;
	for ( let rungY = - 0.15; rungY < y; rungY += 0.3 ) if ( rungY >= - 0.4 ) box( ladderX + 0.25, rungY - 0.15, ladderZ, 0.27, 0.15, 0.3, 'ladder', { walkable: true, solid: false } );
	// Solid rail boundaries leave a deliberate opening at the ladder.
	const side = ( x, za, zb ) => box( x, ( y - 2 ) * 0.5, ( za + zb ) * 0.5, 0.22, ( y + 2 ) * 0.5, ( zb - za ) * 0.5, 'pierRail' );
	side( P.x - P.width * 0.5 - 0.2, P.zStart + 3, P.zEnd + P.headDepth );
	side( P.x + P.width * 0.5 + 0.2, P.zStart + 3, P.zEnd + P.headDepth );
	side( P.x + P.headWidth * 0.5, P.zEnd - P.headDepth, ladderZ - 1 );
	side( P.x + P.headWidth * 0.5, ladderZ + 1, P.zEnd );
	side( P.x - P.headWidth * 0.5, P.zEnd - P.headDepth, P.zEnd );

}
