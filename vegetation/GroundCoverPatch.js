import { bestCandidateBlueNoise } from '../../../src/util/BlueNoise.js';
import { mulberry32 } from '../../../src/util/Noise.js';

// Tidewater's renderer-independent authored ground-cover patch recipe. This
// module emits typed geometry streams; backend presenters and asset exporters
// translate those streams without changing the cell arrangement.
export const CELL = 8;
export const R_NEAR = 18;
export const R_MID = 46;
export const R_FAR = 88;
export const FADE_T2 = [ 11, 17 ];
export const FADE_T1 = [ 36, 45 ];
export const FADE_T0 = [ 62, 87 ];
export const MAX_NEAR = 48;
export const MAX_MID = 160;
export const MAX_FAR = 420;
export const CLUMPS = 384;
export const BLADES = 7;
export const BLADE_TIER = [ 0, 0, 1, 1, 2, 2, 2 ];
export const TIER_N = [ 2, 2, 3 ];
export const OATS = 12;
export const VINES = 28;
const KIND = { GRASS: 0, OAT_STALK: 1, OAT_HEAD: 2, CREEPER: 3, FLOWER: 4 };

class PatchBuilder {

	constructor() {

		this.pos = [];
		this.nor = [];
		this.side = [];
		this.slot = [];
		this.bladeData = [];
		this.idx = [];

	}

	get count() {

		return this.pos.length / 3;

	}

	// side: xyz offset direction * half width, w: across coordinate (-1 left edge, 1 right, 0 tip)
	v( p, n, side, slot, blade ) {

		this.pos.push( p[ 0 ], p[ 1 ], p[ 2 ] );
		this.nor.push( n[ 0 ], n[ 1 ], n[ 2 ] );
		this.side.push( side[ 0 ], side[ 1 ], side[ 2 ], side[ 3 ] ?? 0 );
		this.slot.push( slot[ 0 ], slot[ 1 ], slot[ 2 ], slot[ 3 ] );
		this.bladeData.push( blade[ 0 ], blade[ 1 ], blade[ 2 ], blade[ 3 ] );
		return this.count - 1;

	}

	// blade: centre-line points with half widths; tip row has zero width (single vertex).
	// w4: aBlade.w (grass: tier)
	blade( slot, kind, rows, width, dirX, dirZ, lean, height, curve, rnd, base = [ 0, 0 ], w4 = 0 ) {

		const sx = - dirZ, sz = dirX; // horizontal side direction
		const ids = [];
		for ( let r = 0; r < rows.length; r ++ ) {

			const h = rows[ r ];
			const out = ( Math.sin( lean ) * h + curve * h * h ) * height;
			const up = ( Math.cos( lean ) * h - curve * 0.35 * h * h ) * height;
			const p = [ base[ 0 ] + dirX * out, up, base[ 1 ] + dirZ * out ];
			// tangent for the normal
			const dOut = Math.sin( lean ) + 2 * curve * h, dUp = Math.cos( lean ) - 0.7 * curve * h;
			const tl = Math.hypot( dOut, dUp );
			const tx = dirX * dOut / tl, ty = dUp / tl, tz = dirZ * dOut / tl;
			// normal = side x tangent
			const nx = - sz * ty, ny = sz * tx - sx * tz, nz = sx * ty;
			const nl = Math.hypot( nx, ny, nz ) || 1;
			const n = [ nx / nl, ny / nl, nz / nl ];
			const hw = width * ( 1 - Math.pow( h, 1.6 ) ) * ( 0.75 + 0.25 * ( 1 - h ) );
			const blade = [ h, kind, rnd, w4 ];
			if ( r === rows.length - 1 ) {

				ids.push( [ this.v( p, n, [ 0, 0, 0, 0 ], slot, blade ) ] );

			} else {

				ids.push( [
					this.v( p, n, [ - sx * hw, 0, - sz * hw, - 1 ], slot, blade ),
					this.v( p, n, [ sx * hw, 0, sz * hw, 1 ], slot, blade ),
				] );

			}

		}

		for ( let r = 0; r < ids.length - 1; r ++ ) {

			const a = ids[ r ], b = ids[ r + 1 ];
			if ( b.length === 1 ) this.idx.push( a[ 0 ], a[ 1 ], b[ 0 ] );
			else this.idx.push( a[ 0 ], a[ 1 ], b[ 1 ], a[ 0 ], b[ 1 ], b[ 0 ] );

		}

	}

	// small leaf / flower lying on the ground: triangle fan around a centre point.
	// outline(a) gives the radius factor for angle a (0 = pointing along dir).
	fan( slot, kind, center, radius, dirX, dirZ, tilt, sides, outline, rnd, lift, hf = 0.1 ) {

		const c = this.v( [ center[ 0 ], lift, center[ 1 ] ], [ 0, 1, 0 ], [ 0, 0, 0, 0 ], slot, [ hf, kind, rnd, 1 ] );
		const ring = [];
		for ( let i = 0; i < sides; i ++ ) {

			const a = ( i / sides ) * Math.PI * 2;
			const r = radius * outline( a );
			const lx = Math.cos( a ) * r, lz = Math.sin( a ) * r * 0.85;
			const x = center[ 0 ] + lx * dirX - lz * dirZ;
			const z = center[ 1 ] + lx * dirZ + lz * dirX;
			const along = lx / radius;
			const y = lift + ( along + 0.6 ) * radius * tilt;
			ring.push( this.v( [ x, y, z ], [ 0, 1, 0 ], [ 0, 0, 0, 0 ], slot, [ hf + 0.05 * Math.max( 0, along ), kind, rnd, 0 ] ) );

		}

		for ( let i = 0; i < sides; i ++ ) this.idx.push( c, ring[ ( i + 1 ) % sides ], ring[ i ] );

	}

	// thin ribbon lying on the ground (creeper runner)
	ribbon( slot, kind, pts, width, rnd ) {

		const ids = [];
		for ( let i = 0; i < pts.length; i ++ ) {

			const p = pts[ i ], q = pts[ Math.min( pts.length - 1, i + 1 ) ], o = pts[ Math.max( 0, i - 1 ) ];
			let dx = q[ 0 ] - o[ 0 ], dz = q[ 2 ] - o[ 2 ];
			const l = Math.hypot( dx, dz ) || 1;
			dx /= l; dz /= l;
			const sx = - dz * width, sz = dx * width;
			ids.push( [
				this.v( [ p[ 0 ] - sx, p[ 1 ], p[ 2 ] - sz ], [ 0, 1, 0 ], [ 0, 0, 0, 0 ], slot, [ 0.05, kind, rnd, 0 ] ),
				this.v( [ p[ 0 ] + sx, p[ 1 ], p[ 2 ] + sz ], [ 0, 1, 0 ], [ 0, 0, 0, 0 ], slot, [ 0.05, kind, rnd, 0 ] ),
			] );

		}

		for ( let i = 0; i < ids.length - 1; i ++ ) {

			const a = ids[ i ], b = ids[ i + 1 ];
			this.idx.push( a[ 0 ], b[ 1 ], a[ 1 ], a[ 0 ], b[ 0 ], b[ 1 ] );

		}

	}

	build() {

		return {
			positions: Float32Array.from( this.pos ),
			normals: Float32Array.from( this.nor ),
			sides: Float32Array.from( this.side ),
			slots: Float32Array.from( this.slot ),
			bladeData: Float32Array.from( this.bladeData ),
			indices: this.count > 65535 ? Uint32Array.from( this.idx ) : Uint16Array.from( this.idx ),
			triangles: this.idx.length / 3,
		};

	}

	get triangles() {

		return this.idx.length / 3;

	}

}

// Clump / blade parameters shared by all levels (same seeds -> identical blades).
function clumpParams( seed ) {

	const rand = mulberry32( seed );
	const slots = bestCandidateBlueNoise( mulberry32( seed + 1 ), CLUMPS, CELL );
	return slots.map( ( [ x, z ] ) => {

		const slotRand = rand();
		const az0 = rand() * Math.PI * 2;
		const blades = [];
		for ( let k = 0; k < BLADES; k ++ ) {

			// golden-angle azimuths: any prefix of the blades spreads around the clump; the first
			// two (kept at every distance) lean away from each other
			const az = az0 + k * 2.39996 + ( rand() - 0.5 ) * 0.5;
			const outer = k === 0 ? 0.1 + 0.3 * rand() : k === 1 ? 0.35 + 0.4 * rand() : rand();
			blades.push( {
				dx: Math.cos( az ), dz: Math.sin( az ),
				lean: 0.06 + 0.55 * outer * ( 0.6 + 0.8 * rand() ),
				h: ( 0.7 + 0.5 * rand() ) * ( 1.06 - 0.22 * outer ),
				curve: 0.12 + 0.5 * outer * ( 0.5 + rand() ),
				rnd: rand(),
				base: [ Math.cos( az ) * 0.09 * rand(), Math.sin( az ) * 0.09 * rand() ],
				tier: BLADE_TIER[ k ],
			} );

		}

		return { x, z, slotRand, blades };

	} );

}

// level: 0 near, 1 mid, 2 far
function buildPatch( level, clumps, seed = 7 ) {

	const b = new PatchBuilder();
	const rows = [ [ 0, 0.3, 0.62, 1 ], [ 0, 0.55, 1 ], [ 0, 1 ] ][ level ];
	const maxTier = 2 - level;

	for ( const c of clumps ) {

		const slot = [ c.x, c.z, c.slotRand, 0 ];
		for ( const bl of c.blades ) {

			if ( bl.tier > maxTier ) continue;
			b.blade( slot, KIND.GRASS, rows, 0.012, bl.dx, bl.dz, bl.lean, bl.h, bl.curve, bl.rnd, bl.base, bl.tier );

		}

	}

	if ( level === 2 ) return b;

	// sea oats (tier 1: fade out before the far level) and, near only, beach creeper. Every slot
	// has its own random stream, so the near and mid versions of a plant are identical.
	const oatSlots = bestCandidateBlueNoise( mulberry32( seed + 2 ), OATS, CELL );
	const near = level === 0;
	oatSlots.forEach( ( [ x, z ], si ) => {

		const rand = mulberry32( seed * 7919 + si * 131 + 17 );
		const slot = [ x, z, rand(), 1 ];
		const stalks = near ? 3 : 1;
		for ( let q = 0; q < 3; q ++ ) {

			const az = rand() * Math.PI * 2;
			const dx = Math.cos( az ), dz = Math.sin( az );
			const lean = 0.06 + 0.14 * rand();
			const hq = 0.8 + 0.3 * rand();
			const rnd = rand();
			const bx = q === 0 ? 0 : ( rand() - 0.5 ) * 0.22, bz = q === 0 ? 0 : ( rand() - 0.5 ) * 0.22;
			const hs = [ rand(), rand(), rand(), rand(), rand(), rand(), rand(), rand() ];
			if ( q >= stalks ) continue;
			const qTier = q === 0 ? 0 : 2;
			// stalk (unit height, scaled in the shader)
			b.blade( slot, KIND.OAT_STALK, near ? [ 0, 0.3, 0.6, 0.85, 1 ] : [ 0, 0.6, 1 ], near ? 0.0075 : 0.014, dx, dz, lean, hq, 0.2, rnd, [ bx, bz ], qTier );
			// drooping panicle: flat spikelets hanging off the upper stalk
			const heads = near ? 8 : 3;
			for ( let k = 0; k < heads; k ++ ) {

				const hf = 0.7 + 0.3 * ( k / Math.max( 1, heads - 1 ) );
				const out = ( Math.sin( lean ) * hf + 0.2 * hf * hf ) * hq;
				const up = ( Math.cos( lean ) * hf - 0.07 * hf * hf ) * hq;
				const sa = az + ( k % 2 ? 1 : - 1 ) * ( 0.45 + 0.6 * hs[ k ] );
				const sdx = Math.cos( sa ), sdz = Math.sin( sa );
				const cx = bx + dx * out + sdx * 0.02, cz = bz + dz * out + sdz * 0.02;
				const L = near ? 0.085 : 0.13, W = near ? 0.022 : 0.04;
				const n = [ 0, 1, 0 ];
				const slotB = [ hf, KIND.OAT_HEAD, rnd, qTier ];
				const a = b.v( [ cx, up + 0.01, cz ], n, [ 0, 0, 0, 0 ], slot, slotB );
				const l = b.v( [ cx + sdx * L * 0.45 - sdz * W, up - L * 0.4, cz + sdz * L * 0.45 + sdx * W ], n, [ 0, 0, 0, 0 ], slot, slotB );
				const r = b.v( [ cx + sdx * L * 0.45 + sdz * W, up - L * 0.4, cz + sdz * L * 0.45 - sdx * W ], n, [ 0, 0, 0, 0 ], slot, slotB );
				const t = b.v( [ cx + sdx * L * 0.8, up - L * 0.95, cz + sdz * L * 0.8 ], n, [ 0, 0, 0, 0 ], slot, slotB );
				b.idx.push( a, l, t, a, t, r );

			}

		}

		if ( near ) {

			for ( let k = 0; k < 4; k ++ ) {

				const la = ( k / 4 ) * Math.PI * 2 + rand();
				b.blade( slot, KIND.GRASS, [ 0, 0.45, 0.8, 1 ], 0.01, Math.cos( la ), Math.sin( la ), 0.55 + 0.4 * rand(), 0.45, 0.35, rand(), [ 0, 0 ], 2 );

			}

		}

	} );

	if ( ! near ) return b;

	// beach creeper (railroad vine): a runner crawling over the sand with notched leaves
	const notched = ( a ) => {

		const d = Math.min( Math.abs( a ), Math.abs( a - Math.PI * 2 ) );
		return 1 - 0.38 * Math.exp( - ( d * d ) / 0.12 ) - 0.15 * Math.pow( Math.sin( a * 0.5 ), 8 );

	};
	const petals = ( a ) => 0.82 + 0.18 * Math.cos( a * 5 );
	const vineSlots = bestCandidateBlueNoise( mulberry32( seed + 3 ), VINES, CELL );
	vineSlots.forEach( ( [ x, z ], si ) => {

		const rand = mulberry32( seed * 3571 + si * 197 + 5 );
		const slot = [ x, z, rand(), 2 ];
		let az = rand() * Math.PI * 2;
		const pts = [];
		const n = 12;
		let px = - Math.cos( az ) * 1.1, pz = - Math.sin( az ) * 1.1;
		for ( let i = 0; i < n; i ++ ) {

			pts.push( [ px, 0.01, pz ] );
			az += ( rand() - 0.5 ) * 0.5;
			px += Math.cos( az ) * 0.19;
			pz += Math.sin( az ) * 0.19;

		}

		b.ribbon( slot, KIND.CREEPER, pts, 0.011, rand() );
		for ( let i = 1; i < pts.length; i ++ ) {

			const side = i % 2 ? 1 : - 1;
			const p0 = pts[ i - 1 ], p1 = pts[ i ];
			let dx = p1[ 0 ] - p0[ 0 ], dz = p1[ 2 ] - p0[ 2 ];
			const l = Math.hypot( dx, dz ) || 1;
			dx /= l; dz /= l;
			// leaves stand on short petioles, angled forward off the runner, tilted up
			const la = Math.atan2( dz, dx ) + side * ( 0.7 + 0.5 * rand() );
			const ldx = Math.cos( la ), ldz = Math.sin( la );
			const r = ( 0.07 + 0.04 * rand() ) * ( 0.6 + 0.4 * Math.sin( Math.PI * i / n ) );
			b.fan( slot, KIND.CREEPER, [ p1[ 0 ] + ldx * r * 0.9, p1[ 2 ] + ldz * r * 0.9 ], r, ldx, ldz, 0.3 + 0.3 * rand(), 7, notched, rand(), 0.015 );

		}

		const fp = pts[ 3 + Math.floor( rand() * 4 ) ];
		b.fan( slot, KIND.FLOWER, [ fp[ 0 ] + 0.03, fp[ 2 ] + 0.03 ], 0.036, 1, 0, 1.4, 10, petals, rand(), 0.07, 0.2 );

	} );

	return b;

}



/** Build one of the authored near, mid, or far patch geometries as portable streams. */
export function buildGroundCoverPatch(level, seed = 7) {
	if (!Number.isInteger(level) || level < 0 || level > 2 || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Invalid Tidewater ground-cover patch request');
	return buildPatch(level, clumpParams(seed), seed).build();
}
