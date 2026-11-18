// Tidewater-authored foliage and patch behavior expressed as renderer-neutral
// material-graph data. ElseMesh compiles the same graph to WebGPU and WebGL.

class GraphBuilder {

	constructor() {

		this.nodes = [];
		this.index = 0;

	}

	add( op, props = {} ) {

		const id = `n${this.index ++}`;
		this.nodes.push( { id, op, ...props } );
		return id;

	}

	input( name ) { return this.add( 'input', { name } ); }
	constant( value ) { return this.add( 'constant', { value } ); }
	call( op, ...args ) { return this.add( op, { args } ); }
	texture( slot, uv, lod ) { return this.add( 'textureSampleLevel', { slot, uv, lod } ); }

}

function linearColor( hex ) {
	const channel = value => value <= 0.04045 ? value / 12.92 : ( ( value + 0.055 ) / 1.055 ) ** 2.4;
	return [ channel( ( hex >> 16 & 255 ) / 255 ), channel( ( hex >> 8 & 255 ) / 255 ), channel( ( hex & 255 ) / 255 ) ];
}

/** Build the authored Tidewater patch graph using the signed density grid's world mapping. */
export function createTidewaterGroundCoverMaterialGraph( { densityOrigin, densitySize } ) {
	if ( ! Number.isFinite( densityOrigin ) || ! Number.isFinite( densitySize ) || densitySize <= 0 ) throw new Error( 'Tidewater ground-cover material requires valid density-grid world bounds' );
	const b = new GraphBuilder(), c = value => b.constant( value ), op = ( name, ...args ) => b.call( name, ...args );
	const zero = c( 0 ), one = c( 1 ), half = c( 0.5 ), two = c( 2 );
	const add = ( a, d ) => op( 'add', a, d ), sub = ( a, d ) => op( 'subtract', a, d ), mul = ( a, d ) => op( 'multiply', a, d ), div = ( a, d ) => op( 'divide', a, d );
	const x = value => op( 'x', value ), y = value => op( 'y', value ), z = value => op( 'z', value ), w = value => op( 'w', value );
	const vec2 = ( a, d ) => op( 'vec2', a, d ), vec3 = ( a, d, e ) => op( 'vec3', a, d, e );
	const mix = ( a, d, t ) => op( 'mix', a, d, t ), clamp = ( value, lo, hi ) => op( 'clamp', value, lo, hi );
	const smooth = ( lo, hi, value ) => op( 'smoothstep', c( lo ), c( hi ), value );
	const less = ( a, d ) => op( 'lessThan', a, d ), greater = ( a, d ) => op( 'greaterThan', a, d );
	const select = ( test, yes, no ) => op( 'select', test, yes, no );
	const normalized = value => op( 'normalize', value );
	const constantVec2 = ( a, d ) => c( [ a, d ] );
	const constantVec3 = ( a, d, e ) => c( [ a, d, e ] );
	const input = name => b.input( name );
	const hash12 = p => op( 'hash12', p );
	const valueNoise2 = p => op( 'valueNoise2', p );
	const zeroLod = c( 0 );

	const position = input( 'position' );
	const worldVertexPosition = input( 'worldVertexPosition' );
	const worldPosition = input( 'worldPosition' );
	const worldNormal = input( 'worldNormal' );
	const cameraPosition = input( 'cameraPosition' );
	const sunDirection = input( 'sunDirection' );
	const vdata = input( 'vdata' );
	const slots = input( 'vdata1' );
	const blade = input( 'vdata2' );
	const windDirection = input( 'windDirection' );
	const windSpeed = input( 'windSpeed' );
	const windVelocityIntegral = input( 'windVelocityIntegral' );
	const time = input( 'time' );
	const night = input( 'night' );
	const uvZero = constantVec2( 0, 0 );

	// The ground-cover presenter uses identity rotation and scale, translating each
	// signed patch to its shared cell origin. Subtracting the local vertex position
	// recovers that origin for the world-domain density and terrain lookups.
	const cellOrigin = sub( worldVertexPosition, position );
	const cellX = x( cellOrigin ), cellY = y( cellOrigin ), cellZ = z( cellOrigin );
	const cellXZ = vec2( cellX, cellZ );
	const slotXZ = op( 'xy', slots );
	const xz = add( cellXZ, slotXZ );
	const densityOffset = constantVec2( - densityOrigin, - densityOrigin );
	const densityUV = mul( add( xz, densityOffset ), c( 1 / densitySize ) );
	const density = b.texture( 'densityField', densityUV, zeroLod );
	const dune = x( density ), lush = y( density ), oatDensity = z( density ), vineDensity = w( density );
	const kind = y( blade ), random = z( blade ), hf = x( blade ), across = w( vdata );
	const isGrass = less( kind, c( 0.5 ) );
	const isOat = op( 'and', greater( kind, c( 0.5 ) ), less( kind, c( 2.5 ) ) );
	const duneFraction = div( dune, add( add( dune, lush ), c( 0.001 ) ) );
	const grassDensity = mix( lush, op( 'min', mul( dune, c( 1.1 ) ), one ), duneFraction );
	const kindDensity = select( isOat, oatDensity, vineDensity );
	const slotDensity = select( isGrass, grassDensity, kindDensity );
	const hashPosition1 = add( mul( xz, c( 1.37 ) ), constantVec2( 0.51, 0.51 ) );
	const hashPosition2 = add( mul( xz, c( 2.11 ) ), constantVec2( 7.3, 7.3 ) );
	const densityHash = hash12( hashPosition1 ), flowerHash = hash12( hashPosition2 );
	const flowerAllowed = select( greater( kind, c( 3.5 ) ), select( less( flowerHash, c( 0.35 ) ), one, zero ), one );
	const present = mul( select( less( densityHash, slotDensity ), one, zero ), flowerAllowed );

	// The same two terrain-detail samples drive meadow color and gust response.
	const rotateDetail = ( angle, point ) => {
		const cos = Math.cos( angle ), sin = Math.sin( angle );
		const px = x( point ), pz = y( point );
		return vec2( sub( mul( px, c( cos ) ), mul( pz, c( sin ) ) ), add( mul( px, c( sin ) ), mul( pz, c( cos ) ) ) );
	};
	const detailAt = ( point, scale, offset = uvZero ) => b.texture( 'detailField', add( div( point, c( scale ) ), offset ), zeroLod );
	const meadowA = w( detailAt( rotateDetail( 0.7, xz ), 173 ) );
	const meadowB = w( detailAt( rotateDetail( 2.1, xz ), 47 ) );
	const meadowMix = add( add( mul( meadowA, c( 0.55 ) ), mul( meadowB, c( 0.45 ) ) ), c( 0 ) );
	const olive = smooth( 0.52, 0.6, meadowMix );
	const yellow = smooth( 0.6, 0.67, meadowMix );
	const straw = smooth( 0.66, 0.73, add( meadowMix, mul( sub( meadowB, half ), c( 0.2 ) ) ) );
	const lushFactor = sub( one, smooth( 0.37, 0.46, add( mul( meadowB, c( 0.7 ) ), mul( meadowA, c( 0.3 ) ) ) ) );
	const linearRGB = ( r, g, blue ) => c( [ r, g, blue ].map( value => value <= 0.04045 ? value / 12.92 : ( ( value + 0.055 ) / 1.055 ) ** 2.4 ) );
	const meadowGreen = linearRGB( 0.25, 0.32, 0.1 );
	const meadowOlive = linearRGB( 0.36, 0.37, 0.14 );
	const meadowYellow = linearRGB( 0.5, 0.46, 0.2 );
	const meadowStraw = linearRGB( 0.62, 0.54, 0.33 );
	const meadowLush = linearRGB( 0.13, 0.2, 0.05 );
	let meadowTone = mix( meadowGreen, meadowOlive, olive );
	meadowTone = mix( meadowTone, meadowYellow, mul( yellow, c( 0.8 ) ) );
	meadowTone = mix( meadowTone, meadowStraw, mul( straw, c( 0.55 ) ) );
	meadowTone = mix( meadowTone, meadowLush, mul( lushFactor, c( 0.75 ) ) );
	const dry = add( mul( olive, c( 0.4 ) ), mul( yellow, c( 0.6 ) ) );

	const patchNoiseA = valueNoise2( add( mul( xz, c( 1 / 6.5 ) ), constantVec2( 17.3, 17.3 ) ) );
	const patchNoiseB = valueNoise2( mul( xz, c( 1 / 2.3 ) ) );
	const patchNoise = add( mul( patchNoiseA, c( 0.7 ) ), mul( patchNoiseB, c( 0.3 ) ) );
	const lushHeight = mul( mul( mix( c( 0.7 ), c( 1.3 ), patchNoise ), add( mul( lushFactor, c( 0.25 ) ), one ) ), sub( one, mul( dry, c( 0.25 ) ) ) );
	const grassHeight = mul( mul( mix( lushHeight, c( 0.62 ), duneFraction ), mix( add( mul( flowerHash, c( 0.35 ) ), c( 0.83 ) ), add( mul( mul( flowerHash, flowerHash ), c( 0.9 ) ), c( 0.5 ) ), duneFraction ) ), add( mul( slotDensity, c( 0.35 ) ), c( 0.65 ) ) );
	const oatHeight = add( mul( flowerHash, c( 0.55 ) ), one );
	const vineScale = add( mul( flowerHash, c( 0.4 ) ), c( 0.8 ) );
	const nonGrassHeight = select( isOat, oatHeight, vineScale );
	const heightScale = select( isGrass, grassHeight, nonGrassHeight );
	const spread = select( isGrass, mix( c( 1.35 ), c( 1.3 ), duneFraction ), one );

	// Source tier fade: category identity and tier metadata are in the signed patch.
	const distanceDelta = sub( xz, vec2( x( cameraPosition ), z( cameraPosition ) ) );
	const distance = op( 'length', distanceDelta );
	const tierFromBlade = select( less( kind, c( 2.5 ) ), w( blade ), zero );
	const tier = op( 'max', tierFromBlade, w( slots ) );
	const cutPhase = add( mul( random, c( 7.13 ) ), flowerHash );
	const cutFraction = op( 'fract', cutPhase );
	const cut = mix( c( 67 ), c( 87 ), cutFraction );
	const fade2 = sub( one, smooth( 11, 17, distance ) );
	const fade1 = sub( one, smooth( 36, 45, distance ) );
	const fade0 = sub( one, op( 'smoothstep', sub( cut, c( 5 ) ), cut, distance ) );
	const own = select( greater( tier, c( 1.5 ) ), fade2, select( greater( tier, c( 0.5 ) ), fade1, fade0 ) );
	const compensation = div( c( 7 ), add( add( mul( fade2, c( 3 ) ), mul( fade1, c( 2 ) ) ), c( 2 ) ) );
	const widthK = select( isGrass, mul( compensation, own ), one );
	const sizeK = select( isGrass, one, own );
	const scale = mul( mul( heightScale, present ), sizeK );

	const yaw = mul( hash12( add( mul( xz, c( 0.73 ) ), constantVec2( 3.3, 3.3 ) ) ), c( 6.2832 ) );
	const cosYaw = op( 'cos', yaw ), sinYaw = op( 'sin', yaw );
	const scaledX = mul( x( position ), spread ), scaledY = y( position ), scaledZ = mul( z( position ), spread );
	const localRotated = vec3( sub( mul( scaledX, cosYaw ), mul( scaledZ, sinYaw ) ), scaledY, add( mul( scaledX, sinYaw ), mul( scaledZ, cosYaw ) ) );
	const o0 = mul( localRotated, scale );
	const oLength = op( 'length', o0 );

	const integralDrift = windVelocityIntegral;
	const gustA = w( detailAt( sub( xz, integralDrift ), 140 ) );
	const gustB = w( detailAt( sub( xz, integralDrift ), 61, constantVec2( 0.37, 0.37 ) ) );
	const gustField = smooth( 0.46, 0.6, add( mul( gustA, c( 0.62 ) ), mul( gustB, c( 0.38 ) ) ) );
	const windStrength = op( 'max', mul( windSpeed, c( 0.1 ) ), c( 0.03 ) );
	const bladeHash = densityHash;
	const phase = mul( bladeHash, c( 6.2832 ) );
	const bendPhase = add( add( mul( time, c( 1.9 ) ), phase ), mul( x( xz ), c( 0.2 ) ) );
	const bendAmount = add( mul( windStrength, add( mul( gustField, c( 0.55 ) ), c( 0.22 ) ) ), mul( op( 'sin', bendPhase ), mul( windStrength, c( 0.1 ) ) ) );
	const flutterPhase = add( add( mul( time, c( 7.3 ) ), mul( phase, c( 3 ) ) ), mul( random, c( 20 ) ) );
	const flutter = mul( op( 'sin', flutterPhase ), add( mul( windStrength, c( 0.06 ) ), c( 0.015 ) ) );
	const stiff = select( isGrass, one, select( isOat, c( 0.8 ), c( 0.08 ) ) );
	const hfSquared = mul( hf, hf );
	const windX = x( windDirection ), windZ = y( windDirection );
	const windDir3 = vec3( windX, zero, windZ );
	const windPerp3 = vec3( mul( windZ, c( -1 ) ), zero, windX );
	const bendDisplacement = mul( mul( mul( windDir3, bendAmount ), hfSquared ), stiff );
	const flutterDisplacement = mul( mul( mul( windPerp3, flutter ), hfSquared ), stiff );
	const displacement = mul( add( bendDisplacement, flutterDisplacement ), add( oLength, c( 0.0001 ) ) );
	const offsetPosition = normalized( add( add( o0, displacement ), constantVec3( 0, 0.00001, 0 ) ) );
	const bentPosition = mul( offsetPosition, oLength );
	const widthScale = select( isGrass, mix( c( 1.5 ), c( 1.55 ), duneFraction ), one );
	const wideScale = mul( mul( widthScale, widthK ), op( 'min', mul( scale, two ), op( 'max', scale, c( 0.5 ) ) ) );
	const side = op( 'xyz', vdata );
	const sideX = x( side ), sideY = y( side ), sideZ = z( side );
	const sideRotated = vec3( sub( mul( sideX, cosYaw ), mul( sideZ, sinYaw ) ), sideY, add( mul( sideX, sinYaw ), mul( sideZ, cosYaw ) ) );
	const sideDirection = normalized( add( sideRotated, constantVec3( 0.00001, 0, 0 ) ) );
	const bladeNormal = input( 'normal' );
	const normalX = x( bladeNormal ), normalY = y( bladeNormal ), normalZ = z( bladeNormal );
	const rotatedNormal = vec3( sub( mul( normalX, cosYaw ), mul( normalZ, sinYaw ) ), normalY, add( mul( normalX, sinYaw ), mul( normalZ, cosYaw ) ) );
	const liftedNormal = add( mul( rotatedNormal, c( 0.5 ) ), constantVec3( 0, 1, 0 ) );
	const acrossNormal = mul( sideDirection, mul( across, c( 0.35 ) ) );
	const vertexNormal = normalized( add( liftedNormal, acrossNormal ) );
	const groundHeight = op( 'terrainHeightAt', xz );
	const base = vec3( x( xz ), sub( groundHeight, c( 0.03 ) ), y( xz ) );
	const worldBentPosition = sub( add( add( base, bentPosition ), mul( sideRotated, wideScale ) ), cellOrigin );

	// Grass color is continuous with Tidewater's meadow terrain; other authored
	// categories retain their own stalk, head, creeper, and flower palettes.
	const ao = mix( c( 0.32 ), one, smooth( 0, 0.75, hf ) );
	const duneBase = mix( c( linearColor( 0x5d6232 ) ), c( linearColor( 0x7f8a40 ) ), random );
	const duneTip = mix( c( linearColor( 0xb8ab6c ) ), c( linearColor( 0x9aa452 ) ), random );
	const toneVariation = add( mul( random, c( 0.34 ) ), c( 0.83 ) );
	const tone = mul( meadowTone, toneVariation );
	const meadowSoil = linearRGB( 0.17, 0.13, 0.08 );
	const lushBase = mix( mul( tone, c( 0.5 ) ), meadowSoil, c( 0.3 ) );
	const tipDry = add( mul( dry, c( 0.4 ) ), mul( smooth( 0.8, 1, random ), c( 0.35 ) ) );
	const lushTipBase = mul( tone, constantVec3( 1.25, 1.25, 1.05 ) );
	const lushTip = mix( lushTipBase, meadowStraw, mul( tipDry, smooth( 0.55, 1, hf ) ) );
	const grassBase = mix( lushBase, duneBase, duneFraction );
	const grassTip = mix( lushTip, duneTip, duneFraction );
	let grass = mix( grassBase, grassTip, smooth( 0.05, 0.95, hf ) );
	const dryPhase = add( mul( random, c( 13.7 ) ), mul( densityHash, c( 3.1 ) ) );
	const dryBlade = select( less( op( 'fract', dryPhase ), add( mul( dry, c( 0.3 ) ), c( 0.07 ) ) ), one, zero );
	const deadColor = mul( mix( meadowStraw, mul( meadowSoil, c( 1.8 ) ), mul( random, c( 0.6 ) ) ), add( mul( smooth( 0, 0.5, hf ), c( 0.4 ) ), c( 0.6 ) ) );
	grass = mix( grass, deadColor, mul( dryBlade, sub( one, duneFraction ) ) );
	const midrib = add( mul( op( 'pow', sub( one, op( 'abs', across ) ), c( 6 ) ), mul( smooth( 0.05, 0.4, hf ), c( 0.18 ) ) ), one );
	grass = mul( grass, midrib );
	const gustSheen = mul( clamp( mul( mul( gustField, windStrength ), c( 0.6 ) ), zero, one ), stiff );
	const sheenStrength = mul( mul( gustSheen, smooth( 0.15, 0.9, hf ) ), c( 0.6 ) );
	const sheenColor = add( mul( grass, constantVec3( 1.3, 1.28, 1.1 ) ), constantVec3( 0.03, 0.03, 0.015 ) );
	grass = mix( grass, sheenColor, sheenStrength );
	const oatStalk = mix( c( linearColor( 0x9c9a62 ) ), c( linearColor( 0xc2b27a ) ), hf );
	const oatHead = mix( c( linearColor( 0xc9b27a ) ), c( linearColor( 0xa8905a ) ), random );
	const centre = w( blade );
	const vineBase = mix( mix( c( linearColor( 0x2e5219 ) ), c( linearColor( 0x4a7328 ) ), random ), c( linearColor( 0x7a8f4a ) ), mul( centre, c( 0.3 ) ) );
	const vineLight = select( less( hf, c( 0.075 ) ), constantVec3( 1.25, 1.05, 0.8 ), constantVec3( 1, 1, 1 ) );
	const vine = mul( vineBase, vineLight );
	const flower = mix( c( linearColor( 0xb8479c ) ), c( linearColor( 0xf2e8ee ) ), smooth( 0.35, 0.9, centre ) );
	const grassWithAO = mul( grass, select( less( kind, c( 2.5 ) ), ao, one ) );
	const creeperOrFlower = select( less( kind, c( 3.5 ) ), vine, flower );
	const oatHeadOrOther = select( less( kind, c( 2.5 ) ), oatHead, creeperOrFlower );
	const oatStalkOrOther = select( less( kind, c( 1.5 ) ), oatStalk, oatHeadOrOther );
	const colorBeforeGrass = select( isGrass, grassWithAO, oatStalkOrOther );
	const isCreeper = op( 'and', greater( kind, c( 2.5 ) ), less( kind, c( 3.5 ) ) );
	const roughness = select( isCreeper, c( 0.45 ), c( 0.8 ) );
	const viewDirection = normalized( sub( cameraPosition, worldPosition ) );
	const shadedNormal = normalized( add( normalized( worldNormal ), mul( viewDirection, c( 0.4 ) ) ) );
	const backLight = op( 'pow', clamp( op( 'dot', mul( viewDirection, c( -1 ) ), sunDirection ), zero, one ), c( 4 ) );
	const translucency = mul( mul( mul( colorBeforeGrass, constantVec3( 1.1, 1.3, 0.6 ) ), mul( backLight, c( 0.3 ) ) ), mul( smooth( 0.2, 1, hf ), sub( one, night ) ) );
	const specularIntensity = c( 0.4 );
	const vertexPosition = worldBentPosition;

	return Object.freeze( {
		format: 'elsemesh.material-graph/1',
		nodes: Object.freeze( b.nodes.map( node => Object.freeze( node ) ) ),
		outputs: Object.freeze( {
			baseColor: colorBeforeGrass,
			roughness,
			metalness: zero,
			vertexPosition,
			vertexNormal,
		surfaceNormal: shadedNormal,
			translucency,
			specularIntensity,
		} ),
	} );
}
