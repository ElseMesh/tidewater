import { ShaderModule } from '../../../../src/engine/gpu/Shader.js';
import { commonModule } from '../../../../src/engine/render/wgsl/common.js';
import { standard } from '../../../../src/materials/Materials.js';
import { createWebGPUMaterialGraph } from '../../../../src/materials/WorldMaterialGraph.js';
import { VillageTextures } from './TextureBaker.js';
import { TIDEWATER_NET_MATERIAL_GRAPH, TIDEWATER_THATCH_MATERIAL_GRAPH, TIDEWATER_FABRIC_MATERIAL_GRAPH, TIDEWATER_STONE_MATERIAL_GRAPH, TIDEWATER_ROOF_METAL_MATERIAL_GRAPH } from '../../VillageMaterialGraphs.js';

// Shared PBR materials for the village, pier and props.
//
// Surface detail comes from tileable texture sets baked on the GPU at startup (see
// TextureBaker.js): albedo / mask maps plus RG normal, B roughness, A ambient occlusion.
// UVs are in metres (GeoBuilder), so texel density is constant (256-1024 px/m).
// Per-vertex attributes keep every piece unique:
//   tint  (vec3) base color (paint color, wood tone, rope color ...)
//   vdata (vec4) material specific parameters (documented per material below)
// Normal layers are blended in slope (derivative) space; a second, higher frequency detail
// normal fades in near the camera and a low frequency macro layer hides tiling.
// Each material samples at most 4 textures.
// Materials: wood (+ glass, pattern 9), roofMetal, thatch, hard (+ rope), stone, fabric.
//
// WGSL port notes: the TSL colorNode / roughnessNode / normalNode / ... are `surface` snippets
// writing the Surface (s.normal in WORLD space: the three normalMap() of a packed slope normal is
// perturbNormalByMap() with the mesh uv derivative frame); positionNode is the `vertex` snippet.
// tint / vdata reach the fragment stage as the varyings vTint / vData. G.* -> frame.*.
// Textures are bound as vlg<Name> and sampled with the shared smpAnisoRepeat sampler
// (trilinear, 8x anisotropic, repeat - the TSL version's finalTexture() settings).
//
// WGSL (villageMaterialModule, shared by all the village materials):
//   fn vlmHash21( x: f32, y: f32 ) -> f32                    sin hash
//   fn vlmSlopeOf( t: vec4f ) -> vec2f                      baked normal (RG) -> surface slope
//   fn vlmNormalFromSlope( in: FragInput, s: vec2f ) -> vec3f   slope in uv space -> world normal
//   fn vlmBand01( p: f32, k: f32 ) -> f32
//   fn vlmTidal( P: vec3f, col: vec3f, rough: f32 ) -> VlmTidal   (tidalModule; reads the vlgGrime binding)

const TAU = Math.PI * 2;

export const villageMaterialModule = new ShaderModule( {
	name: 'villageMaterials',
	deps: [ commonModule ],
	code: /* wgsl */`
const VLM_TAU: f32 = ${ TAU };

fn vlmHash21( x: f32, y: f32 ) -> f32 { return fract( sin( x * 12.9898 + y * 78.233 ) * 43758.5453 ); }
fn vlmN01( n: f32 ) -> f32 { return n * 0.5 + 0.5; }

// baked normal (RG = xy of a unit normal) -> surface slope ( -dh/du, -dh/dv )
fn vlmSlopeOf( t: vec4f ) -> vec2f {
	let xy = t.xy * 2.0 - 1.0;
	return xy / sqrt( max( 1.0 - dot( xy, xy ), 0.04 ) );
}

fn vlmBand01( p: f32, k: f32 ) -> f32 { return step( k - 0.5, p ) * step( p, k + 0.5 ); }

// three normalMap( packN( vec3( s, 1 ) ) ): tangent frame from the mesh uv derivatives
fn vlmNormalFromSlope( P: vec3f, N: vec3f, uv: vec2f, s: vec2f ) -> vec3f {
	return perturbNormalByMap( P, N, uv, normalize( vec3f( s, 1.0 ) ) );
}

`,
} );

// tidal zone (materials that bind the grime map as vlgGrime and sit in the splash zone)
const tidalModule = new ShaderModule( {
	name: 'villageTidal',
	deps: [ villageMaterialModule ],
	code: /* wgsl */`
struct VlmTidal { col: vec3f, rough: f32, wet: f32 };

// Tidal zone: algae / barnacles / wet darkening driven by world height above sea level.
fn vlmTidal( pw: vec3f, col: vec3f, rough: f32 ) -> VlmTidal {
	let q = vec2f( pw.x + pw.z * 0.7, pw.y );
	let Gt = textureSample( vlgGrime, smpAnisoRepeat, q * vec2f( 0.6, 1.2 ) );
	let y = pw.y + ( Gt.a - 0.5 ) * 0.3;
	let wet = 1.0 - smoothstep( 0.3, 0.75, y );
	let damp = ( 1.0 - smoothstep( 0.7, 1.5, y ) ) * 0.4;
	let algae = mix( vec3f( 0.028, 0.042, 0.02 ), vec3f( 0.11, 0.105, 0.05 ), Gt.a * 0.6 + Gt.r * 0.4 );
	let Gb = textureSample( vlgGrime, smpAnisoRepeat, q * 3.1 );
	let barn = Gb.b * smoothstep( - 1.6, - 0.35, y ) * ( 1.0 - smoothstep( 0.25, 0.6, y ) );
	var c = col * ( 1.0 - damp );
	c = mix( c, algae, wet );
	c = mix( c, vec3f( 0.52, 0.5, 0.44 ), barn * 0.9 );
	var r = mix( rough, 0.3, wet * 0.9 );
	r = mix( r, 0.55, damp );
	r = mix( r, 0.9, barn );
	return VlmTidal( c, r, wet );
}
`,
} );

// per-vertex tint / vdata -> fragment
const VARYINGS = { vTint: 'vec3f', vData: 'vec4f' };
const ATTRIBUTES = { tint: 'vec3f', vdata: 'vec4f' };
const PASS_ATTRS = '\to.vTint = v.tint;\n\to.vData = v.vdata;\n';

function villageMaterial( params, T, names, { surface, vertex = '' } ) {

	const textures = {};
	for ( const n of names ) textures[ 'vlg' + n[ 0 ].toUpperCase() + n.slice( 1 ) ] = T[ n ];
	const m = standard( {
		...params,
		modules: [ commonModule, villageMaterialModule ],
		attributes: ATTRIBUTES,
		varyings: VARYINGS,
		textures,
		vertex: PASS_ATTRS + vertex,
	} );
	m.surface = surface;
	return m;

}

// ---------------------------------------------------------------------------
// WOOD: raw and painted timber.
// vdata: x seed, y paint (0 raw, 0.3 heavily worn .. 1 fresh; < 0: raw deck board with a worn walking
//        path along it, centred at u = -paint - 1), z pattern, w weathering (0 fresh .. 1 silver)
// World-space weathering on every piece: rain / rust streaks down vertical faces, bird droppings on
// upward faces above head height, the tidal belt near the water (vlmTidal).
// patterns: 0 plain, 1 lap siding, 2 board & batten, 3 vertical tongue & groove,
//           4 louvers, 5 planks along u (staves, clinker), 6 horizontal planks (flush),
//           7 nailed deck plank (nail heads + rust stains every 0.8 m),
//           9 GLASS (window panes / lantern glass): vdata = seed, kind (0 window, 1 lantern), 9, lit
// tint: paint color when painted, otherwise a wood tone multiplier.
// uv: metres, u along the grain; end-grain faces are flagged with u + 1000, post tops with u + 2000.

export function createWoodMaterial( T ) {

	const m = villageMaterial( { roughness: 0.85, metalness: 0 }, T, [ 'woodA', 'woodN', 'paintN', 'grime' ], { surface: /* wgsl */`
	let aTint = in.vs.vTint;
	let aData = in.vs.vData;
	let seed = aData.x;
	let paint = aData.y;
	let pattern = aData.z;
	let weather = aData.w;
	let uv0 = in.uv;
	let isCap = step( 1500.0, uv0.x );
	let isEnd = step( 500.0, uv0.x ) * ( 1.0 - isCap );
	let endAny = max( isCap, isEnd );
	let uvS = uv0 - vec2f( isCap * 2000.0 + isEnd * 1000.0, 0.0 );
	let fw = fwidth( uvS );
	let px = max( fw.x, fw.y );
	let near = 1.0 - smoothstep( 0.0012, 0.005, px );

	let mLap = vlmBand01( pattern, 1.0 );
	let mBB = vlmBand01( pattern, 2.0 );
	let mTG = vlmBand01( pattern, 3.0 );
	let mLv = vlmBand01( pattern, 4.0 );
	let mPk = vlmBand01( pattern, 5.0 );
	let mHz = vlmBand01( pattern, 6.0 );
	let mNail = step( 6.5, pattern );
	let isVert = mBB + mTG;
	let g = mix( uvS, uvS.yx, isVert ); // g.x along the grain

	// every board of siding / planking gets its own piece of the wood texture
	let boardIdx = floor( uvS.y / 0.2 ) * mLap + floor( uvS.y / 0.16 ) * mHz
		+ floor( uvS.x / 0.42 ) * mBB + floor( uvS.x / 0.14 ) * mTG + floor( uvS.y / 0.105 ) * mPk;
	let pieceSeed = seed * 131.0 + boardIdx * 7.13;
	let off = vec2f( vlmHash21( pieceSeed, 1.7 ), vlmHash21( pieceSeed, 9.2 ) );
	let tuv = g * vec2f( 0.5, 1.0 ) + off;
	let A = textureSample( vlgWoodA, smpAnisoRepeat, tuv );
	let N = textureSample( vlgWoodN, smpAnisoRepeat, tuv );
	let D = textureSample( vlgWoodN, smpAnisoRepeat, tuv * vec2f( 3.0, 4.0 ) + vec2f( 0.37, 0.61 ) );

	// grime / salt / macro variation in mesh space
	let Gm = textureSample( vlgGrime, smpAnisoRepeat, uvS * 0.5 + off.yx * 0.5 );
	let macroV = textureSample( vlgGrime, smpAnisoRepeat, uvS * 0.07 + vec2f( seed * 0.37, seed * 0.71 ) ).a;
	let hasPaint = step( 0.001, paint );
	// raw timber weathers along the grain: the same grime map stretched ~15x along the board, so
	// dirt, salt and tone vary in long streaks and change gradually from one end to the other
	let Gs = textureSample( vlgGrime, smpAnisoRepeat, g * vec2f( 0.035, 0.55 ) + off * 0.5 );
	let rawK = 1.0 - hasPaint;

	// end grain: polar remap of the side-grain texture -> growth rings become arcs (plank ends) or circles (post tops)
	let pith = mix(
		vec2f( vlmHash21( seed, 5.3 ) * 0.4 - 0.6, vlmHash21( seed, 6.1 ) * 0.3 + 0.25 ),
		vec2f( ( vlmHash21( seed, 3.1 ) - 0.5 ) * 0.02, ( vlmHash21( seed, 4.7 ) - 0.5 ) * 0.02 ),
		isCap
	);
	let ev = uvS - pith;
	let er = length( ev );
	let eUV = vec2f( atan2( ev.y, ev.x ) / VLM_TAU * 3.0 + off.x, er + off.y );
	let eLod = log2( max( fwidth( er ) * 1024.0, 1.0 ) );
	let E = textureSampleLevel( vlgWoodA, smpAnisoRepeat, eUV, eLod );

	// raw timber colour: the baked map is fully weathered silver; less weathered pieces shift to warm brown
	let wW = clamp( weather + ( macroV - 0.5 ) * 0.35, 0.0, 1.0 );
	// wood exposed under chipped paint was protected until recently: lighter and warmer
	let wWx = wW * mix( 1.0, 0.6, hasPaint );
	let sideCol = mix( A.rgb * vec3f( 1.26, 1.02, 0.78 ) * 1.04, A.rgb, smoothstep( 0.12, 0.6, wWx ) );
	let endCol = mix( E.rgb * vec3f( 1.3, 1.0, 0.7 ), E.rgb, wW ) * 0.66;
	let woodTone = mix( aTint, vec3f( 1.2 ), hasPaint );
	let boardTone = ( vlmHash21( pieceSeed, 3.3 ) - 0.5 ) * 0.16 + ( Gs.a - 0.5 ) * 0.14;
	let wood = mix( sideCol, endCol, endAny ) * woodTone * ( macroV * 0.2 + 0.9 ) * ( 1.0 + boardTone * rawK );

	// paint film: chips follow the baked chip field; the film has thickness at the chip edges
	// chip field quantiles: 5% 0.26, 10% 0.31, 20% 0.35, 30% 0.39 -> paint 0.7 leaves ~8% bare wood,
	// 0.6 ~14%, 0.5 ~22%; lap drip edges and the splash zone near wall bottoms wear faster
	let chip = A.a;
	let lapEdge = ( 1.0 - smoothstep( 0.0, 0.18, fract( uvS.y / 0.2 ) ) ) * mLap;
	let lowWall = ( 1.0 - smoothstep( 0.0, 0.7, uvS.y ) ) * ( mLap + mBB + mTG );
	let thr = clamp( 0.395 - ( paint - 0.4 ) * 0.32 + lapEdge * 0.05 + lowWall * 0.05, 0.15, 0.55 );
	let painted = smoothstep( thr - 0.012, thr + 0.012, chip ) * hasPaint * ( 1.0 - endAny );
	let e = 1.0 / 1024.0;
	let cX = textureSample( vlgWoodA, smpAnisoRepeat, tuv + vec2f( e, 0.0 ) ).a - textureSample( vlgWoodA, smpAnisoRepeat, tuv - vec2f( e, 0.0 ) ).a;
	let cY = textureSample( vlgWoodA, smpAnisoRepeat, tuv + vec2f( 0.0, e ) ).a - textureSample( vlgWoodA, smpAnisoRepeat, tuv - vec2f( 0.0, e ) ).a;
	let edge = ( 1.0 - smoothstep( 0.0, 0.025, abs( chip - thr ) ) ) * hasPaint * near;
	let edgeSlope = vec2f( cX, cY ) * edge * - 9.0;
	let P = textureSample( vlgPaintN, smpAnisoRepeat, g * vec2f( 1.0, 2.0 ) + off * 3.7 );

	let fade = clamp( Gm.a * 0.55 + wW * 0.25 + macroV * 0.2, 0.0, 1.0 );
	let chalk = aTint * 0.64 + vec3f( 0.27, 0.265, 0.25 );
	// bright paints (white trim, cream siding) never stay white out here: dusty, yellowed, grey
	let aged = mix( aTint, aTint * vec3f( 0.86, 0.84, 0.77 ), smoothstep( 0.45, 0.8, luminance( aTint ) ) * ( 0.6 + Gm.a * 0.4 ) );
	let paintCol = mix( aged, chalk, fade * 0.5 ) * ( ( P.b - 0.5 ) * 0.16 + 1.0 );

	// siding / plank patterns (shading and slope in mesh space)
	let fvLap = fract( uvS.y / 0.2 );
	let lapFade = 1.0 - smoothstep( 0.02, 0.07, fw.y );
	let lapShade = mix( 0.92, mix( 0.45, 1.03, smoothstep( 0.0, 0.09, fvLap ) ) - fvLap * 0.07, lapFade );
	let lapSy = mix( 0.0, select( - 0.14, - 2.4, fvLap < 0.07 ), lapFade );

	let fuBB = fract( uvS.x / 0.42 );
	let bbFade = 1.0 - smoothstep( 0.03, 0.09, fw.x );
	let inBatten = step( fuBB, 0.12 );
	let bbShade = mix( 0.95, mix( 1.0, 0.7, ( 1.0 - smoothstep( 0.12, 0.2, fuBB ) ) * ( 1.0 - inBatten ) ) * ( inBatten * 0.06 + 1.0 ), bbFade );
	let bbSx = select( select( 0.0, 2.0, abs( fuBB - 0.112 ) < 0.012 ), - 2.0, fuBB < 0.015 ) * bbFade;

	let fuTG = fract( uvS.x / 0.14 );
	let tgFade = 1.0 - smoothstep( 0.015, 0.05, fw.x );
	let tgShade = mix( 0.96, mix( 0.6, 1.0, smoothstep( 0.0, 0.06, fuTG ) ), tgFade );
	let tgSx = select( select( 0.0, 1.0, fuTG < 0.06 ), - 1.0, fuTG < 0.03 ) * tgFade;

	let fvLv = fract( uvS.y / 0.07 );
	let lvFade = 1.0 - smoothstep( 0.008, 0.03, fw.y );
	let lvShade = mix( 0.8, mix( 0.42, 1.05, smoothstep( 0.0, 0.8, fvLv ) ), lvFade );
	let lvSy = mix( 0.0, select( - 1.0, 1.2, fvLv > 0.85 ), lvFade );

	let fvPk = fract( uvS.y / 0.105 );
	let pkFade = 1.0 - smoothstep( 0.012, 0.04, fw.y );
	let pkShade = mix( 0.95, mix( 0.58, 1.0, smoothstep( 0.0, 0.07, fvPk ) ), pkFade );
	let pkSy = select( select( 0.0, 1.0, fvPk < 0.07 ), - 1.0, fvPk < 0.035 ) * pkFade;

	let fvHz = fract( uvS.y / 0.16 );
	let hzFade = 1.0 - smoothstep( 0.015, 0.05, fw.y );
	let hzShade = mix( 0.95, mix( 0.5, 1.0, smoothstep( 0.0, 0.05, fvHz ) ), hzFade );

	let shade = 1.0
		+ mLap * ( lapShade - 1.0 ) + mBB * ( bbShade - 1.0 ) + mTG * ( tgShade - 1.0 )
		+ mLv * ( lvShade - 1.0 ) + mPk * ( pkShade - 1.0 ) + mHz * ( hzShade - 1.0 );

	// nail heads with rust bleed on deck planks
	let nu = ( fract( ( uvS.x - 0.1 ) / 0.8 + 0.5 ) - 0.5 ) * 0.8;
	let nv = min( abs( uvS.y - 0.045 ), abs( uvS.y - 0.155 ) );
	let nearN = 1.0 - smoothstep( 0.0015, 0.004, px );
	let nail = ( 1.0 - smoothstep( 0.0045, 0.0075, length( vec2f( nu, nv ) ) ) ) * mNail * nearN;
	let stain = ( 1.0 - smoothstep( 0.0, 0.05, length( vec2f( nu * 0.3, nv * 1.4 ) ) ) ) * mNail;

	// ---- colour
	var col = mix( wood * ( stain * - 0.4 + 1.0 ), paintCol, painted );
	col = mix( col, vec3f( 0.04, 0.032, 0.028 ), nail );
	let dirt = mix( 0.22, 0.5, wW );
	let Gd = mix( Gm, Gs, rawK );
	col = col * ( 1.0 - Gd.r * dirt * mix( 0.75, 0.35, rawK ) );
	col = mix( col, vec3f( 0.62, 0.61, 0.57 ), Gd.g * mix( 0.28, 0.16, rawK ) * ( painted * 0.5 + 0.5 ) );
	col = col * ( 1.0 - Gm.b * 0.3 * hasPaint );
	let isWall = mLap + mBB + mTG;
	// splash-back along the bottom of walls: rain throws sand and soil up the boards, and green
	// mildew grows where they stay damp; a ragged upper edge
	let splashH = 0.55 + ( Gm.a - 0.5 ) * 0.5 + ( macroV - 0.5 ) * 0.3;
	let splash = ( 1.0 - smoothstep( 0.0, splashH, uvS.y ) ) * isWall;
	col = col * ( 1.0 - splash * 0.5 );
	col = mix( col, col * vec3f( 0.78, 0.9, 0.62 ), splash * smoothstep( 0.4, 0.7, Gm.a + Gm.b * 0.5 ) * 0.7 );
	let ao = mix( N.a, mix( 1.0, N.a, 0.35 ) * P.a, painted );
	col = col * shade * mix( 1.0, ao, 0.5 );

	// ---- world-space weathering
	let Ng = in.N;
	let upF = sat( Ng.y );
	let sideF = 1.0 - abs( Ng.y );
	// worn walking path down the middle of deck boards: fibres worn off (paler, warmer, smoother),
	// grey dirt ground into the grain and dark scuffs
	let walkC = - paint - 1.0;
	let wd = ( uvS.x - walkC + ( macroV - 0.5 ) * 0.5 ) / 0.6;
	let walkK = step( paint, - 0.5 ) * smoothstep( 0.6, 0.9, upF ) * exp( - wd * wd ) * ( 1.0 - endAny );
	// the path is worn brown-grey: the silver skin scuffed off, grime trodden into the grain
	let trodden = col * vec3f( 0.8, 0.76, 0.72 );
	col = mix( col, trodden, walkK * 0.55 );
	// grit and dirt packed along the edges of deck boards (the gaps collect it)
	let bev = min( uvS.y, 0.18 - uvS.y );
	let edgeDirt = mNail * smoothstep( 0.6, 0.9, upF ) * ( 1.0 - smoothstep( 0.004, 0.03, bev ) ) * ( 1.0 - endAny );
	col = col * ( 1.0 - edgeDirt * ( 0.18 + Gs.r * 0.15 ) );
	// water that pools along the board edges keeps them damp and darker in broad, gradual bands
	// (no blotches: it follows the boards); sun and salt bleach the open middle of the deck
	let damp = smoothstep( 0.6, 0.9, upF ) * rawK * ( 1.0 - endAny ) * smoothstep( 0.45, 0.75, macroV );
	col = col * ( 1.0 - damp * ( 1.0 - smoothstep( 0.0, 0.06, bev ) ) * 0.18 );
	// rain and rust streaks running down vertical faces (from nails, bolts, sills and roof edges)
	let sqA = textureSample( vlgGrime, smpAnisoRepeat, vec2f( ( in.P.x + in.P.z ) * 2.3 + seed * 5.0, in.P.y * 0.12 ) );
	let sqB = textureSample( vlgGrime, smpAnisoRepeat, vec2f( ( in.P.x - in.P.z ) * 5.1, in.P.y * 0.3 + 0.37 ) );
	let streak = sideF * sideF * clamp( smoothstep( 0.45, 0.85, sqB.r ) + smoothstep( 0.6, 0.7, sqA.a ) * 0.35, 0.0, 1.0 ) * ( 0.45 + wW * 0.55 ) * ( 1.0 - endAny );
	let rustS = streak * smoothstep( 0.5, 0.6, sqA.a );
	col = col * ( 1.0 - streak * 0.24 );
	col = mix( col, col * vec3f( 1.04, 0.78, 0.6 ), rustS * 0.6 );
	// bird droppings: sparse splats on upward faces above head height (rails, posts, cap beams, sills)
	let bq = in.P.xz / 0.3;
	let bc = floor( bq );
	let bh = vlmHash21( bc.x + seed, bc.y );
	let bo = fract( bq ) - 0.5 - ( vec2f( vlmHash21( bc.x + 3.1, bc.y ), vlmHash21( bc.x, bc.y + 7.7 ) ) - 0.5 ) * 0.45;
	let bd = length( bo * vec2f( 1.0, 1.35 ) ) + ( Gm.a - 0.5 ) * 0.08;
	let dropK = step( 0.93, bh ) * smoothstep( 0.75, 0.95, upF ) * step( 2.6, in.P.y ) * ( 1.0 - smoothstep( 0.1, 0.15, bd ) );
	let dropCore = dropK * ( 1.0 - smoothstep( 0.02, 0.07, bd ) );
	col = mix( col, mix( vec3f( 0.62, 0.61, 0.56 ), vec3f( 0.8, 0.79, 0.74 ), dropCore ), dropK * 0.6 );

	// ---- normal (grain space -> mesh space) + analytic pattern relief
	let sWood = vlmSlopeOf( N ) + vlmSlopeOf( D ) * near * 0.5;
	let sPaint = vlmSlopeOf( N ) * 0.3 + vlmSlopeOf( P );
	let sG = ( mix( sWood, sPaint, painted ) + edgeSlope ) * ( 1.0 - endAny * 0.6 ) * ( 1.0 - walkK * 0.45 ) * ( 1.0 - dropK * 0.7 );
	let sM = mix( sG, sG.yx, isVert );
	let sPat = vec2f(
		mBB * bbSx + mTG * tgSx,
		mLap * lapSy + mLv * lvSy + mPk * pkSy
	);
	// ---- roughness: satin-ish paint vs dry raw timber; grime and salt dull it
	let roughRaw = N.b + wW * 0.03;
	let roughPaint = mix( 0.4, 0.7, P.b ) + fade * 0.12;
	let rough = mix( roughRaw, roughPaint, painted ) + Gm.r * 0.06 + Gm.g * 0.08 - nail * 0.3 - walkK * 0.1 + streak * 0.05 - dropCore * 0.2;
	let res = vlmTidal( in.P, col, rough );

	// ---- glass mode (windows and lanterns share this material to save a draw call)
	let isGlass = step( 8.5, pattern );
	let glass = vlmGlass( in.uv, aTint, seed, paint, weather );
	s.albedo = mix( res.col, glass.color, isGlass );
	s.roughness = clamp( mix( res.rough, glass.rough, isGlass ), 0.03, 1.0 );
	s.ao = mix( ao, 1.0, isGlass );
	s.emissive = glass.emissive * isGlass;
	s.normal = vlmNormalFromSlope( in.P, in.N, in.uv, ( sM + sPat ) * ( 1.0 - isGlass ) );
` } );
	m.name = 'VillageWood';
	m.modules.push( tidalModule, glassModule );
	return m;

}

// ---------------------------------------------------------------------------
// CORRUGATED METAL ROOFING
// uv: u = distance up-slope from the eave (m), v = along the eave (m)
// vdata: x seed, y rust amount, z galvanized (1) / painted (0)

export function createRoofMetalMaterial( T ) {
	const m = createWebGPUMaterialGraph( {
		name: 'VillageRoofMetal',
		pbrMetallicRoughness: { roughnessFactor: 0.5, metallicFactor: 0.2 },
	}, TIDEWATER_ROOF_METAL_MATERIAL_GRAPH, {
		graphTextures: { metallicRoughness: T.roofA, normal: T.roofN, occlusion: T.hardN },
	} );
	m.name = 'VillageRoofMetal';
	return m;

}

// ---------------------------------------------------------------------------
// PALM THATCH
// uv: u = distance up-slope from the eave (m), v = along the eave (m)
// vdata: x seed, y age (0 golden .. 1 grey)

export function createThatchMaterial( T ) {
	const m = createWebGPUMaterialGraph( {
		name: 'VillageThatch',
		doubleSided: false,
		pbrMetallicRoughness: { roughnessFactor: 0.95, metallicFactor: 0 },
	}, TIDEWATER_THATCH_MATERIAL_GRAPH, {
		graphTextures: { metallicRoughness: T.thatchA, normal: T.thatchN, occlusion: T.grime },
	} );
	m.name = 'VillageThatch';
	return m;

}

// ---------------------------------------------------------------------------
// HARD SURFACES: iron, steel, galvanized, rubber, plastic, painted metal - and rope.
// vdata: x seed, y rust (0..1), z metalness, w roughness
// rope: vdata.w = 2 + rope radius (uv: u along the rope, v around, metres)

export function createHardMaterial( T ) {

	const m = villageMaterial( { roughness: 0.5, metalness: 0.5 }, T, [ 'hardA', 'hardN', 'rope', 'grime' ], { surface: /* wgsl */`
	let aTint = in.vs.vTint;
	let aData = in.vs.vData;
	let seed = aData.x;
	let rustAmt = aData.y;
	let isRope = step( 1.5, aData.w );
	let uv0 = in.uv;
	let off = vec2f( vlmHash21( seed, 2.3 ), vlmHash21( seed, 8.9 ) );
	let tuv = uv0 + off;
	let HA = textureSample( vlgHardA, smpAnisoRepeat, tuv );
	let HN = textureSample( vlgHardN, smpAnisoRepeat, tuv );
	let hasRust = step( 0.001, rustAmt );
	let thr = mix( 0.95, 0.3, rustAmt );
	let rust = smoothstep( thr - 0.06, thr + 0.06, HA.r ) * hasRust;
	var base = aTint * ( 1.0 - HA.b * 0.2 ) * ( ( HA.r - 0.5 ) * 0.1 + 1.0 );
	base = mix( base, vec3f( 0.3, 0.3, 0.29 ), HA.g * 0.55 * hasRust * ( 1.0 - rust ) );
	let rustCol = mix( vec3f( 0.12, 0.045, 0.02 ), vec3f( 0.4, 0.17, 0.06 ), smoothstep( 0.3, 0.9, HA.r ) );
	let hardCol = mix( base, rustCol, rust ) * mix( 1.0, HN.a, 0.5 );
	let hardRough = mix( clamp( aData.w + ( HN.b - 0.5 ) * 0.35 - HA.g * 0.15 * hasRust, 0.04, 1.0 ), 0.88, rust );
	let hardS = vlmSlopeOf( HN ) * ( rust * 0.8 + 0.25 );

	// rope: uvs normalised by the circumference so the three strands wrap seamlessly
	let ropeR = max( aData.w - 2.0, 0.004 );
	let R = textureSample( vlgRope, smpAnisoRepeat, uv0 / ( ropeR * VLM_TAU ) + vec2f( aData.x * 3.1, 0.0 ) );
	let ropeCol = aTint * mix( 0.45, 1.25, R.r ) * mix( 1.0, R.g, 0.6 );
	let rn = R.ba * 2.0 - 1.0;
	let ropeS = rn / sqrt( max( 1.0 - dot( rn, rn ), 0.04 ) );

	let res = vlmTidal( in.P, mix( hardCol, ropeCol, isRope ), mix( hardRough, 0.93, isRope ) );
	s.normal = vlmNormalFromSlope( in.P, in.N, in.uv, mix( hardS, ropeS, isRope ) );
	s.albedo = res.col;
	s.roughness = res.rough;
	s.metalness = aData.z * ( 1.0 - max( rust, res.wet ) ) * ( 1.0 - isRope );
	s.ao = mix( HN.a, R.g, isRope );
` } );
	m.name = 'VillageHard';
	m.modules.push( tidalModule );
	return m;

}

// ---------------------------------------------------------------------------
// GLASS (evaluated inside the wood material): window panes and lantern glass, emissive at night.
// uv: normalized 0..1 across a pane. kind 0 window / 1 lantern, lit 0/1, tint: curtain / glass color

const glassModule = new ShaderModule( {
	name: 'villageGlass',
	deps: [ villageMaterialModule ],
	code: /* wgsl */`
struct VlmGlass { color: vec3f, rough: f32, emissive: vec3f };

fn vlmGlass( uvm: vec2f, aTint: vec3f, seed: f32, kind: f32, lit: f32 ) -> VlmGlass {
	// grime map channels: R streaks, G salt, B spots, A macro
	let Gl = textureSample( vlgGrime, smpAnisoRepeat, uvm * 0.45 + vec2f( seed * 3.7, seed * 1.3 ) );
	let edgeD = min( min( uvm.x, 1.0 - uvm.x ), min( uvm.y, 1.0 - uvm.y ) );
	let frameDirt = 1.0 - smoothstep( 0.0, 0.07, edgeD );
	let curtain = ( 1.0 - smoothstep( 0.18, 0.3, uvm.x ) + smoothstep( 0.7, 0.82, uvm.x ) ) * step( 0.35, seed );
	let folds = vlmN01( sin( uvm.x * 70.0 + seed * 20.0 ) );
	let interior = vec3f( 0.012, 0.014, 0.017 ) * ( Gl.a * 0.8 + 0.6 );
	var winCol = mix( interior, aTint * 0.16 * ( folds * 0.4 + 0.6 ), curtain );
	winCol = winCol + vec3f( 0.05, 0.05, 0.045 ) * Gl.g + vec3f( 0.03, 0.026, 0.02 ) * ( Gl.b + frameDirt );
	let lanternCol = aTint * 0.55 * ( 1.0 - Gl.b * 0.25 );
	let isLantern = step( 0.5, kind );
	let color = mix( winCol, lanternCol, isLantern );
	let rough = mix( 0.035 + Gl.r * 0.22 + Gl.g * 0.18 + Gl.b * 0.1 + frameDirt * 0.25, 0.32 + Gl.r * 0.15, isLantern );

	let nightOn = smoothstep( 0.15, 0.75, frame.night );
	let warm = vec3f( 1.0, 0.56, 0.24 );
	let center = 1.0 - smoothstep( 0.1, 0.75, abs( uvm.x - 0.5 ) * 1.4 + abs( uvm.y - 0.62 ) );
	let winGlow = mix( warm * ( center * 0.6 + 0.5 ), ( aTint * 0.5 + warm * 0.5 ) * ( folds * 0.3 + 0.45 ), curtain )
		* ( vlmHash21( seed, 3.1 ) * 0.5 + 0.75 ) * 3.2 * ( 1.0 - Gl.r * 0.25 );
	let flicker = sin( frame.time * 9.0 + seed * 40.0 ) * sin( frame.time * 5.3 + seed * 13.0 ) * 0.12 + 0.9;
	let lanternGlow = vec3f( 1.0, 0.64, 0.3 ) * 6.0 * flicker;
	let emissive = mix( winGlow, lanternGlow, isLantern ) * nightOn * max( lit, isLantern );
	return VlmGlass( color, rough, emissive );
}
`,
} );

// ---------------------------------------------------------------------------
// Rubble, plaster, end grain, and ground dust share the signed renderer-neutral graph.
export function createStoneMaterial( T ) {
	const m = createWebGPUMaterialGraph( {
		name: 'VillageStone',
		pbrMetallicRoughness: { roughnessFactor: 0.92, metallicFactor: 0 },
	}, TIDEWATER_STONE_MATERIAL_GRAPH, {
		graphTextures: { baseColor: T.stoneA, normal: T.stoneN, metallicRoughness: T.paintN, occlusion: T.grime },
	} );
	m.name = 'VillageStone';
	return m;
}

// Cloth, tarps, nets, and flags share the signed renderer-neutral graph.
export function createFabricMaterial( T ) {
	const m = createWebGPUMaterialGraph( {
		name: 'VillageFabric',
		doubleSided: true,
		alphaMode: 'MASK',
		alphaCutoff: 0.5,
		pbrMetallicRoughness: { roughnessFactor: 0.88, metallicFactor: 0 },
	}, TIDEWATER_FABRIC_MATERIAL_GRAPH, {
		graphTextures: { metallicRoughness: T.net, occlusion: T.grime },
	} );
	m.name = 'VillageFabric';
	return m;
}

// ---------------------------------------------------------------------------
// NETS: blended, no depth write. Knotted mesh up close (soft-edged strands from the net texture);
// further away the strands average into a see-through veil of the right coverage. Alpha testing
// (or dithering) the sub-pixel strands wrote a noisy foreground depth over whatever is behind the net,
// and the TAA reprojected the background with it: grain and ghosted houses behind every net.
// vdata as for FABRIC nets: x seed, y sway weight, z mesh size (m).

function createNetMaterial( textures ) {
	const material = createWebGPUMaterialGraph( {
		name: 'VillageNet', doubleSided: true, alphaMode: 'BLEND',
		pbrMetallicRoughness: { baseColorFactor: [ 1, 1, 1, 1 ], roughnessFactor: 0.9, metallicFactor: 0 },
	}, TIDEWATER_NET_MATERIAL_GRAPH, { graphTextures: { metallicRoughness: textures.net } } );
	material.name = 'VillageNet';
	return material;
}

export function createVillageMaterials( textures = new VillageTextures() ) {

	const T = textures.textures;
	return {
		wood: createWoodMaterial( T ),
		roofMetal: createRoofMetalMaterial( T ),
		thatch: createThatchMaterial( T ),
		hard: createHardMaterial( T ),
		stone: createStoneMaterial( T ),
		fabric: createFabricMaterial( T ),
		net: createNetMaterial( T ),
	};

}
