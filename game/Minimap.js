import { Vector3 } from '../../../src/engine/math/index.js';
import { WorldNavigator } from '../../../src/ui/WorldNavigator.js';

// Minimap, lower right: the island baked once from the terrain data into a 2D canvas (depth-tinted
// sea, reef and seagrass, sand, grass and forest by height, rock, paths, village pads, the pier,
// hill shading and a coastline), shown in a round window that turns with the view (forward is up,
// a small N on the rim). Markers: the player (centre arrow), Joe's fish stand, Marta's chandlery
// and the boat; markers beyond the rim sit on it with an arrow. With the fish finder upgrade, a
// couple of soft rings mark the richest water in view.
//
// Per frame it only writes a few CSS transforms. The bake runs in row chunks over the first frames.
//   const map = new Minimap( hudEl, game );  map.update( dt );  map.highlight( [ 'joe', 'marta' ] )

const N = 640; // baked canvas size (px)
const EXT = 1280; // metres covered by the bake
const X0 = - EXT / 2, Z0 = - 180 - EXT / 2; // world at canvas (0, 0): the island sits north of the bay
const PPM = N / EXT; // canvas px per metre
const ROWS_PER_FRAME = 48;
const _vehicleForward = new Vector3();

const ICON = {
	fish: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 12c3-4 7-6 11-6 3 0 5 2 7 4l-2 2 2 2c-2 2-4 4-7 4-4 0-8-2-11-6Zm12-1.2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z"/></svg>',
	anchor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="5" r="2"/><path d="M12 7v13M7 11h10M4 14c1 4 4 6 8 6s7-2 8-6"/></svg>',
	boat: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v9H6l6-9Zm1 2 5 7h-5V5ZM3 14h18l-3 5H6l-3-5Z"/></svg>',
};

const mix = ( a, b, t ) => [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t, a[ 2 ] + ( b[ 2 ] - a[ 2 ] ) * t ];
const sat = ( x ) => Math.min( 1, Math.max( 0, x ) );
const smooth = ( e0, e1, x ) => {

	const t = sat( ( x - e0 ) / ( e1 - e0 ) );
	return t * t * ( 3 - 2 * t );

};

// map palette (sRGB 0..255)
const C = {
	deep: [ 12, 44, 78 ], mid: [ 22, 104, 150 ], shallow: [ 62, 186, 190 ], foam: [ 186, 232, 226 ],
	grassSea: [ 34, 110, 108 ], rubble: [ 30, 84, 104 ],
	sand: [ 232, 216, 172 ], wet: [ 206, 190, 150 ], grass: [ 128, 160, 88 ], scrub: [ 88, 128, 64 ], forest: [ 52, 92, 50 ],
	rock: [ 132, 134, 126 ], path: [ 205, 182, 136 ], scarp: [ 176, 146, 104 ], pad: [ 196, 184, 162 ],
};

export class Minimap {

	constructor( parent, game ) {

		this.game = game;
		this.navigator = new WorldNavigator( parent, { radius: 110, labels: [ { text: 'N', x: 0, z: - 1 } ] } );
		this.el = this.navigator.el;
		this.mapCanvas = document.createElement( 'canvas' ); this.mapCanvas.width = N; this.mapCanvas.height = N;
		this._fishPts = [];
		this._fishT = 0;

		this.radiusM = 110; // world radius shown (m), eased between on foot and at sea
		this._hot = new Set();
		this._bake = { row: 0, ctx: this.mapCanvas.getContext( '2d' ), img: null, h: null, done: false };
		this._bake.img = this._bake.ctx.createImageData( N, N );
		this._bake.h = new Float32Array( N * N );

	}

	highlight( ids = [] ) {

		this._hot = new Set( ids );

	}

	// ---- bake (chunked)
	_bakeStep() {

		const B = this._bake;
		if ( B.done ) return;
		const T = this.game.app.terrainData;
		const res = T.res, tex = T.texel, org = T.origin;
		const idx = ( x, z ) => {

			const i = Math.floor( ( x - org ) / tex ), j = Math.floor( ( z - org ) / tex );
			return i < 0 || j < 0 || i >= res || j >= res ? - 1 : j * res + i;

		};

		const d = B.img.data;
		const end = Math.min( N, B.row + ROWS_PER_FRAME );
		for ( let py = B.row; py < end; py ++ ) for ( let px = 0; px < N; px ++ ) {

			const x = X0 + ( px + 0.5 ) / PPM, z = Z0 + ( py + 0.5 ) / PPM;
			const hgt = T.heightAt( x, z );
			B.h[ py * N + px ] = hgt;
			const k = idx( x, z );
			let c;
			if ( hgt < 0 ) {

				const dep = - hgt;
				c = dep < 6 ? mix( C.shallow, C.mid, smooth( 0.3, 6, dep ) ) : mix( C.mid, C.deep, smooth( 6, 40, dep ) );
				if ( k >= 0 ) {

					c = mix( c, C.grassSea, ( T.seagrass[ k ] / 255 ) * 0.55 );
					c = mix( c, C.rubble, ( T.rubble[ k ] / 255 ) * 0.6 );

				}

				c = mix( c, C.foam, smooth( 0.5, 0.0, dep ) * 0.45 );

			} else {

				const rock = k >= 0 ? T.rock[ k ] : 0, sand = k >= 0 ? T.sand[ k ] / 255 : 0;
				c = mix( C.grass, C.scrub, smooth( 4, 16, hgt ) );
				c = mix( c, C.forest, smooth( 12, 40, hgt ) );
				c = mix( c, C.sand, Math.max( sand, smooth( 1.6, 0.4, hgt ) ) );
				c = mix( c, C.wet, smooth( 0.5, 0.0, hgt ) * 0.6 );
				c = mix( c, C.rock, smooth( 0.35, 0.7, rock ) );
				if ( k >= 0 ) {

					c = mix( c, C.path, ( T.path[ k ] / 255 ) * 0.85 );
					c = mix( c, C.scarp, ( T.scarp[ k ] / 255 ) * 0.5 );

				}

				// hill shading, light from the north-west
				const e = 2.5;
				const gx = ( T.heightAt( x + e, z ) - T.heightAt( x - e, z ) ) / ( 2 * e );
				const gz = ( T.heightAt( x, z + e ) - T.heightAt( x, z - e ) ) / ( 2 * e );
				const nl = ( - gx * - 0.6 + - gz * - 0.6 + 1 * 0.53 ) / Math.sqrt( gx * gx + gz * gz + 1 );
				const s = 0.7 + 0.45 * sat( nl / 0.53 );
				c = [ c[ 0 ] * s, c[ 1 ] * s, c[ 2 ] * s ];

			}

			const o = ( py * N + px ) * 4;
			d[ o ] = c[ 0 ]; d[ o + 1 ] = c[ 1 ]; d[ o + 2 ] = c[ 2 ]; d[ o + 3 ] = 255;

		}

		B.row = end;
		if ( B.row < N ) return;

		// coastline: a thin pale line where the height crosses sea level
		for ( let py = 1; py < N - 1; py ++ ) for ( let px = 1; px < N - 1; px ++ ) {

			const i = py * N + px, a = B.h[ i ] >= 0;
			if ( a && ( B.h[ i - 1 ] < 0 || B.h[ i + 1 ] < 0 || B.h[ i - N ] < 0 || B.h[ i + N ] < 0 ) ) {

				const o = i * 4;
				d[ o ] = d[ o ] * 0.3 + 245 * 0.7; d[ o + 1 ] = d[ o + 1 ] * 0.3 + 241 * 0.7; d[ o + 2 ] = d[ o + 2 ] * 0.3 + 228 * 0.7;

			}

		}

		const ctx = B.ctx;
		ctx.putImageData( B.img, 0, 0 );
		const P = ( x, z ) => [ ( x - X0 ) * PPM, ( z - Z0 ) * PPM ];

		// village pads (house footprints)
		ctx.fillStyle = `rgb(${ C.pad.join( ',' ) })`;
		for ( const p of T.pads || [] ) {

			const [ cx, cy ] = P( p.x, p.z );
			const r = Math.max( 1.5, p.radius * 0.8 * PPM );
			ctx.fillRect( cx - r, cy - r, 2 * r, 2 * r );

		}

		// the pier and its head
		const W = this.game.fishingAreas.pier;
		ctx.fillStyle = '#d9c7a0';
		ctx.strokeStyle = 'rgba(40, 30, 20, 0.55)';
		ctx.lineWidth = 0.6;
		const [ px0, pz0 ] = P( W.x - Math.max( W.width, 3 ) / 2, W.zStart );
		const [ px1, pz1 ] = P( W.x + Math.max( W.width, 3 ) / 2, W.zEnd );
		ctx.fillRect( px0, pz0, px1 - px0, pz1 - pz0 );
		ctx.strokeRect( px0, pz0, px1 - px0, pz1 - pz0 );
		const [ hx0, hz0 ] = P( W.x - W.headWidth / 2, W.zEnd - W.headDepth );
		const [ hx1, hz1 ] = P( W.x + W.headWidth / 2, W.zEnd );
		ctx.fillRect( hx0, hz0, hx1 - hx0, hz1 - hz0 );
		ctx.strokeRect( hx0, hz0, hx1 - hx0, hz1 - hz0 );
		B.done = true;
		B.img = null;
		this.navigator.setMap( this.mapCanvas, { minX: X0, maxX: X0 + EXT, minZ: Z0, maxZ: Z0 + EXT } );

	}

	// ---- per frame
	update( dt ) {

		this._bakeStep();
		const app = this.game.app, cam = app.camera, p = app.player;
		// The world provides its current position/heading and authored points; ElseMesh
		// owns the reusable map, compass-label, marker and edge-arrow presentation.
		const e = cam.matrixWorld.elements;
		let fx = - e[ 8 ], fz = - e[ 10 ];
		if ( ( p.mode === 'boat' || p.mode === 'deck' ) && p.boat?.forward ) {
			const forward = p.boat.forward( _vehicleForward );
			fx = forward.x;
			fz = forward.z;
		}
		const x = cam.position.x, z = cam.position.z;

		// zoom: close on foot, wider at sea
		const want = p.mode === 'boat' || p.mode === 'deck' || p.mode === 'swim' ? 240 : 110;
		this.radiusM += ( want - this.radiusM ) * ( 1 - Math.exp( - dt * 1.5 ) );

		// fish finder: the richest water nearby, refreshed now and then
		const finder = this.game.state.stats.finder;
		this._fishT -= dt;
		if ( finder && this._fishT <= 0 ) {

			this._fishT = 1.5;
			this._fishPts = this._richest( x, z, this.radiusM * 0.85 );

		}

		const boat = app.boatCtl;
		const markers = [
			{ id: 'joe', icon: ICON.fish, color: 'var(--em-sun)', position: this.game.vendorPosition( 'joe' ) },
			{ id: 'marta', icon: ICON.anchor, color: 'var(--em-aqua)', position: this.game.vendorPosition( 'marta' ) },
			{ id: 'boat', icon: ICON.boat, position: boat ? { x: boat.position.x, z: boat.position.z } : null, hidden: p.mode === 'boat' || p.mode === 'deck' },
		].filter( marker => marker.position ).map( marker => ( { ...marker, highlighted: this._hot.has( marker.id ) } ) );
		const forward = { x: fx, z: fz };
		this.navigator.update( { dt, position: { x, z }, forward, radius: this.radiusM, markers, overlays: finder ? this._fishPts : [] } );

	}

	// the two richest points on a coarse polar grid around (x, z), at least 25 m apart
	_richest( x, z, r ) {

		const g = this.game, T = g.app.terrainData;
		const pts = [];
		for ( let ring = 1; ring <= 3; ring ++ ) for ( let a = 0; a < 12; a ++ ) {

			const ang = ( a / 12 ) * Math.PI * 2 + ring * 0.4, d = r * ring / 3;
			const px = x + Math.cos( ang ) * d, pz = z + Math.sin( ang ) * d;
			const depth = - T.heightAt( px, pz );
			if ( depth < 1 ) continue;
			const hab = g.habitatAtPoint( px, pz, depth );
			let rich = 0;
			for ( const k in hab ) rich += hab[ k ];
			if ( rich > 0.7 ) pts.push( { x: px, z: pz, rich } );

		}

		pts.sort( ( a, b ) => b.rich - a.rich );
		const out = [];
		for ( const q of pts ) if ( out.every( ( o ) => Math.hypot( o.x - q.x, o.z - q.z ) > 25 ) ) {

			out.push( q );
			if ( out.length === 2 ) break;

		}

		return out;

	}

}
