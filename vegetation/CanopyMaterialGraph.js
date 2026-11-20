import { TIDEWATER_CANOPY_PROFILE as PROFILE } from './CanopyProfile.js';

// The GLB carries no baked canopy color. The signed graph supplies the authored
// palette and the per-instance/per-card inputs used by Tidewater's source shader.
export const TIDEWATER_CANOPY_NEAR_PBR_BASE_COLOR = Object.freeze( [ 1, 1, 1 ] );
export const TIDEWATER_CANOPY_COVERAGE_CUTOFF = 0.5;

function linearColor( hex ) {
	const linear = value => {
		const channel = value / 255;
		return channel < 0.04045 ? channel * 0.0773993808 : Math.pow( channel * 0.9478672986 + 0.0521327014, 2.4 );
	};
	return [ linear( ( hex >> 16 ) & 255 ), linear( ( hex >> 8 ) & 255 ), linear( hex & 255 ) ];
}

function buildCanopyMaterialGraph() {
	const nodes = [];
	const add = ( op, values = {} ) => {
		const id = `n${nodes.length}`;
		nodes.push( { id, op, ...values } );
		return id;
	};
	const constant = value => add( 'constant', { value } );
	const input = name => add( 'input', { name } );
	const unary = ( op, value ) => add( op, { args: [ value ] } );
	const binary = ( op, left, right ) => add( op, { args: [ left, right ] } );
	const ternary = ( op, a, b, c ) => add( op, { args: [ a, b, c ] } );
	const mix = ( a, b, t ) => ternary( 'mix', a, b, t );
	const choose = ( condition, yes, no ) => ternary( 'select', condition, yes, no );
	const color = hex => constant( linearColor( hex ) );
	const colorMix = ( low, high, factor ) => mix( color( low ), color( high ), factor );

	const uv = input( 'uv' );
	const vertexMaterial = input( 'vdata1' );
	const part = unary( 'x', vertexMaterial );
	const ao = unary( 'y', vertexMaterial );
	const colorRandom = unary( 'z', vertexMaterial );
	const instanceData = input( 'instanceMaterial0' );
	const seed = unary( 'w', instanceData );
	const heightData = input( 'vdata' );
	const heightFraction = unary( 'x', heightData );
	const branchFlex = unary( 'y', heightData );
	const leafFlutter = unary( 'z', heightData );
	const leafPhase = unary( 'w', heightData );

	// Deform the portable near meshes from world wind inputs in the shared
	// material graph. Instance yaw and scale are authored in materialData1 so
	// this remains equivalent after the engine applies the instance transform.
	const position = input( 'position' );
	const worldVertexPosition = input( 'worldVertexPosition' );
	const windDirection = input( 'windDirection' );
	const windSpeed = input( 'windSpeed' );
	const windVelocityIntegral = input( 'windVelocityIntegral' );
	const time = input( 'time' );
	const instanceTransform = input( 'instanceMaterial1' );
	const yaw = unary( 'y', instanceTransform );
	const instanceScale = unary( 'z', instanceTransform );
	const verticalScale = unary( 'x', instanceTransform );
	const cosYaw = unary( 'cos', yaw );
	const sinYaw = unary( 'sin', yaw );
	const windX = unary( 'x', windDirection );
	const windZ = unary( 'y', windDirection );
	const localWindX = binary( 'subtract', binary( 'multiply', windX, cosYaw ), binary( 'multiply', windZ, sinYaw ) );
	const localWindZ = binary( 'add', binary( 'multiply', windX, sinYaw ), binary( 'multiply', windZ, cosYaw ) );
	const worldX = unary( 'x', worldVertexPosition );
	const worldZ = unary( 'z', worldVertexPosition );
	const worldXZ = add( 'vec2', { args: [ worldX, worldZ ] } );
	const gustPosition = binary( 'subtract', worldXZ, windVelocityIntegral );
	const gustWide = unary( 'valueNoise2', binary( 'divide', gustPosition, constant( 140 ) ) );
	const gustDetailPosition = binary( 'add', binary( 'divide', gustPosition, constant( 61 ) ), constant( [ 0.37, 0.37 ] ) );
	const gustDetail = unary( 'valueNoise2', gustDetailPosition );
	const gustNoise = binary( 'add', binary( 'multiply', gustWide, constant( 0.62 ) ), binary( 'multiply', gustDetail, constant( 0.38 ) ) );
	const gust = ternary( 'smoothstep', constant( 0.46 ), constant( 0.6 ), gustNoise );
	const windStrength = binary( 'max', binary( 'multiply', windSpeed, constant( 0.1 ) ), constant( 0.03 ) );
	const seedPhase = binary( 'multiply', seed, constant( 6.2832 ) );
	const heightSquared = binary( 'multiply', heightFraction, heightFraction );
	const heightDataY = unary( 'z', instanceData );
	const gustSway = binary( 'multiply', binary( 'multiply', windStrength, windStrength ), binary( 'multiply', constant( 0.009 ), binary( 'add', binary( 'multiply', gust, constant( 0.8 ) ), constant( 0.3 ) ) ) );
	const waveSway = binary( 'multiply', unary( 'sin', binary( 'add', binary( 'multiply', time, constant( 0.9 ) ), seedPhase ) ), binary( 'multiply', windStrength, binary( 'multiply', constant( 0.0045 ), binary( 'add', gust, constant( 0.4 ) ) ) ) );
	const sway = binary( 'multiply', binary( 'multiply', binary( 'add', gustSway, waveSway ), heightDataY ), heightSquared );
	const perpendicularSway = binary( 'multiply', unary( 'sin', binary( 'add', binary( 'multiply', time, constant( 0.67 ) ), binary( 'multiply', seedPhase, constant( 1.3 ) ) ) ), binary( 'multiply', windStrength, binary( 'multiply', constant( 0.002 ), binary( 'multiply', heightDataY, heightSquared ) ) ) );
	const branchWavePhase = binary( 'add', binary( 'multiply', time, binary( 'add', leafPhase, constant( 1.7 ) ) ), binary( 'add', binary( 'multiply', leafPhase, constant( 20 ) ), seedPhase ) );
	const branchWave = binary( 'multiply', unary( 'sin', branchWavePhase ), binary( 'multiply', branchFlex, binary( 'multiply', windStrength, binary( 'multiply', instanceScale, binary( 'multiply', constant( 0.07 ), binary( 'add', gust, constant( 0.5 ) ) ) ) ) ) );
	const branchSag = binary( 'multiply', branchFlex, binary( 'multiply', windStrength, binary( 'multiply', windStrength, binary( 'multiply', instanceScale, binary( 'multiply', constant( 0.04 ), binary( 'add', gust, constant( 0.3 ) ) ) ) ) ) );
	const branch = binary( 'subtract', branchWave, branchSag );
	const verticalInstanceScale = binary( 'multiply', instanceScale, verticalScale );
	const flutterPhase = binary( 'add', binary( 'multiply', time, constant( 9.5 ) ), binary( 'add', binary( 'multiply', leafPhase, constant( 50 ) ), binary( 'add', binary( 'multiply', worldX, constant( 1.9 ) ), binary( 'multiply', worldZ, constant( 2.3 ) ) ) ) );
	const flutter = binary( 'multiply', unary( 'sin', flutterPhase ), binary( 'multiply', leafFlutter, binary( 'multiply', instanceScale, binary( 'add', binary( 'multiply', windStrength, constant( 0.035 ) ), constant( 0.005 ) ) ) ) );
	const localSwayX = binary( 'divide', binary( 'subtract', binary( 'multiply', localWindX, sway ), binary( 'multiply', localWindZ, perpendicularSway ) ), instanceScale );
	const localSwayZ = binary( 'divide', binary( 'add', binary( 'multiply', localWindZ, sway ), binary( 'multiply', localWindX, perpendicularSway ) ), instanceScale );
	const windNormal = input( 'normal' );
	const flutterX = binary( 'divide', binary( 'multiply', unary( 'x', windNormal ), flutter ), instanceScale );
	const flutterY = binary( 'divide', binary( 'multiply', unary( 'y', windNormal ), flutter ), verticalScale );
	const flutterZ = binary( 'divide', binary( 'multiply', unary( 'z', windNormal ), flutter ), instanceScale );
	const vertexOffset = add( 'vec3', { args: [ binary( 'add', localSwayX, flutterX ), binary( 'add', binary( 'divide', branch, verticalInstanceScale ), flutterY ), binary( 'add', localSwayZ, flutterZ ) ] } );
	const deformedPosition = binary( 'add', position, vertexOffset );

	const treeSeedMultiplier = constant( PROFILE.species.treeSeedMultiplier );
	const treeSeedFraction = unary( 'fract', binary( 'multiply', seed, treeSeedMultiplier ) );
	const treeSpeciesCount = constant( PROFILE.palette.trees.length );
	const treeSpecies = unary( 'floor', binary( 'multiply', treeSeedFraction, treeSpeciesCount ) );
	const shrubSeedMultiplier = constant( PROFILE.species.shrubSeedMultiplier );
	const shrubSeedFraction = unary( 'fract', binary( 'multiply', seed, shrubSeedMultiplier ) );
	const shrubSeaGrapeThreshold = constant( PROFILE.species.shrubSeaGrapeThreshold );
	const shrubCrotonThreshold = constant( PROFILE.species.shrubCrotonThreshold );
	const shrubSpecies = choose(
		binary( 'lessThan', shrubSeedFraction, shrubSeaGrapeThreshold ),
		constant( 0 ),
		choose( binary( 'lessThan', shrubSeedFraction, shrubCrotonThreshold ), constant( 1 ), constant( 2 ) ),
	);
	const isShrub = binary( 'greaterThan', part, constant( 2.5 ) );
	const isTree = unary( 'not', isShrub );
	const isBark = binary( 'or', binary( 'lessThan', part, constant( 0.5 ) ), binary( 'greaterThan', part, constant( 4.5 ) ) );

	function paletteColor( palette, species ) {
		const entries = palette.map( entry => {
			let base = colorMix( entry.low, entry.high, colorRandom );
			if ( entry.dry !== undefined ) {
				const dry = mix( base, color( entry.dry ), binary( 'multiply', ternary( 'smoothstep', constant( entry.dryStart ), constant( entry.dryEnd ), colorRandom ), constant( entry.dryMix ) ) );
				base = dry;
			}
			return base;
		} );
		let selected = entries.at( -1 );
		for ( let index = entries.length - 2; index >= 0; index -- ) {
			selected = choose( binary( 'lessThan', species, constant( index + 0.5 ) ), entries[ index ], selected );
		}
		return selected;
	}

	const treeColor = paletteColor( PROFILE.palette.trees, treeSpecies );
	const shrubColor = paletteColor( PROFILE.palette.shrubs, shrubSpecies );
	const isDryTreeSeed = binary( 'step', unary( 'hash12', binary( 'vec2', binary( 'multiply', seed, constant( 5.9 ) ), constant( 8.3 ) ) ), constant( PROFILE.species.dryTreeChance ) );
	const instanceTint = binary( 'add', binary( 'multiply', unary( 'hash12', binary( 'vec2', binary( 'multiply', seed, constant( 17.3 ) ), constant( 4.1 ) ) ), constant( PROFILE.color.instanceTintScale ) ), constant( PROFILE.color.instanceTintBias ) );
	let leafPalette = binary( 'multiply', choose( isShrub, shrubColor, treeColor ), instanceTint );
	const dryTreeColor = colorMix( PROFILE.palette.dryTree.low, PROFILE.palette.dryTree.high, colorRandom );
	const dryTreeWeight = binary( 'multiply', isDryTreeSeed, choose( isTree, constant( 1 ), constant( 0 ) ) );
	leafPalette = mix( leafPalette, dryTreeColor, binary( 'multiply', dryTreeWeight, constant( PROFILE.palette.dryTree.mix ) ) );
	const flowerSeed = binary( 'step', constant( PROFILE.species.floweringTreeThreshold ), unary( 'hash12', binary( 'vec2', binary( 'multiply', seed, constant( 5.9 ) ), constant( 8.3 ) ) ) );
	const floweringWeight = binary( 'multiply', binary( 'multiply', flowerSeed, choose( isTree, constant( 1 ), constant( 0 ) ) ), binary( 'step', constant( 0.5 ), colorRandom ) );
	leafPalette = mix( leafPalette, color( PROFILE.palette.floweringTree ), binary( 'multiply', floweringWeight, constant( 0.5 ) ) );
	const luminance = binary( 'dot', leafPalette, constant( [ 0.2126, 0.7152, 0.0722 ] ) );
	const gray = add( 'vec3', { args: [ luminance, luminance, luminance ] } );
	leafPalette = mix( gray, leafPalette, constant( PROFILE.color.leafDesaturation ) );

	// Species-specific leaf veins, croton variegation, flowers, and aging colors.
	const leafMaskUv = uv;
	const treeSpeciesHalf = binary( 'multiply', treeSpecies, constant( 0.5 ) );
	const treeUsesWideTile = binary( 'greaterThan', unary( 'fract', treeSpeciesHalf ), constant( 0.25 ) );
	const treeTile = choose( treeUsesWideTile, constant( 1 ), constant( 0 ) );
	const shrubIsCroton = binary( 'and', binary( 'lessThan', shrubSeedFraction, shrubCrotonThreshold ), binary( 'greaterEqual', shrubSeedFraction, shrubSeaGrapeThreshold ) );
	const shrubTile = choose( shrubIsCroton, constant( 3 ), constant( 2 ) );
	const tile = choose( isShrub, shrubTile, treeTile );
	const tileU = unary( 'fract', binary( 'multiply', tile, constant( 0.5 ) ) );
	const tileV = binary( 'multiply', unary( 'floor', binary( 'multiply', tile, constant( 0.5 ) ) ), constant( 0.5 ) );
	const atlasU = binary( 'add', binary( 'multiply', unary( 'x', leafMaskUv ), constant( 0.5 ) ), tileU );
	const atlasV = binary( 'add', binary( 'multiply', unary( 'y', leafMaskUv ), constant( 0.5 ) ), tileV );
	const atlasUv = binary( 'vec2', atlasU, atlasV );
	const leafMask = add( 'textureSample', { slot: 'leafMask', uv: atlasUv } );
	const leafCoverage = unary( 'x', leafMask );
	const leafCell = unary( 'z', leafMask );
	const leafBrightness = binary( 'multiply', unary( 'y', leafMask ), constant( 1.4 ) );
	const seaGrape = binary( 'and', isShrub, binary( 'lessThan', shrubSpecies, constant( 0.5 ) ) );
	const croton = binary( 'and', isShrub, binary( 'equal', shrubSpecies, constant( 1 ) ) );
	const hibiscus = binary( 'and', isShrub, binary( 'greaterThan', shrubSpecies, constant( 1.5 ) ) );
	const redVeinWeight = binary( 'multiply', binary( 'multiply', choose( seaGrape, constant( 1 ), constant( 0 ) ), ternary( 'smoothstep', constant( 0.86 ), constant( 0.98 ), leafCell ) ), constant( 0.55 ) );
let leafColor = mix( leafPalette, color( 0x7a3a22 ), redVeinWeight );
	const crotonColor = choose( binary( 'greaterThan', unary( 'fract', binary( 'multiply', leafCell, constant( 7.3 ) ) ), constant( 0.5 ) ), color( 0x9a8a30 ), color( 0x7a3a22 ) );
	const crotonWeight = binary( 'multiply', binary( 'multiply', choose( croton, constant( 1 ), constant( 0 ) ), ternary( 'smoothstep', constant( 0.72 ), constant( 0.9 ), leafCell ) ), constant( 0.55 ) );
	leafColor = mix( leafColor, crotonColor, crotonWeight );
	leafColor = choose( binary( 'and', hibiscus, binary( 'greaterThan', leafCell, constant( 0.92 ) ) ), color( 0xb3261e ), leafColor );
	const agingPattern = unary( 'fract', binary( 'multiply', leafCell, constant( 3.7 ) ) );
	const agingColor = choose( binary( 'greaterEqual', unary( 'fract', binary( 'multiply', leafCell, constant( 3.7 ) ) ), constant( 0.5 ) ), color( 0x8a7a3a ), color( 0x7e3e22 ) );
	const agingWeight = binary( 'multiply', binary( 'multiply', binary( 'step', constant( 0.984 ), agingPattern ), choose( isTree, constant( 1 ), constant( 0 ) ) ), constant( 0.6 ) );
	leafColor = mix( leafColor, agingColor, agingWeight );
	const outer = ternary( 'smoothstep', constant( 0.62 ), constant( 1 ), ao );
	const outerTint = binary( 'multiply', leafColor, constant( [ 1.16, 1.22, 0.92 ] ) );
	leafColor = mix( leafColor, outerTint, binary( 'multiply', outer, constant( 0.7 ) ) );
	const aoTint = mix( constant( [ 0.55, 0.55, 0.55 ] ), constant( [ 1, 1, 1 ] ), ao );
	leafColor = binary( 'multiply', binary( 'multiply', leafColor, aoTint ), leafBrightness );

	// Match the source bark's layered weathering and moss using portable value noise.
	const uvX = unary( 'x', uv ), uvY = unary( 'y', uv );
	const barkNoise = unary( 'valueNoise2', binary( 'vec2', binary( 'multiply', uvX, constant( 30 ) ), binary( 'add', binary( 'multiply', uvY, constant( 2.5 ) ), binary( 'multiply', seed, constant( 40 ) ) ) ) );
	const barkNoise2 = unary( 'valueNoise2', binary( 'vec2', binary( 'multiply', uvX, constant( 6 ) ), binary( 'multiply', uvY, constant( 0.7 ) ) ) );
	const barkBase = mix( color( PROFILE.palette.bark.dark ), color( PROFILE.palette.bark.mid ), binary( 'add', binary( 'multiply', barkNoise, constant( 0.6 ) ), binary( 'multiply', barkNoise2, constant( 0.4 ) ) ) );
	const barkPale = mix( barkBase, color( PROFILE.palette.bark.pale ), binary( 'multiply', ternary( 'smoothstep', constant( PROFILE.palette.bark.paleStart ), constant( PROFILE.palette.bark.paleEnd ), barkNoise2 ), constant( PROFILE.palette.bark.paleMix ) ) );
	const mossNoise = unary( 'valueNoise2', binary( 'vec2', binary( 'multiply', uvX, constant( 9 ) ), binary( 'add', binary( 'multiply', uvY, constant( 1.3 ) ), binary( 'multiply', seed, constant( 11 ) ) ) ) );
	const mossHeight = binary( 'add', mossNoise, binary( 'multiply', binary( 'subtract', constant( 0.35 ), heightFraction ), constant( 0.6 ) ) );
	const mossWeight = binary( 'multiply', ternary( 'smoothstep', constant( 0.45 ), constant( 0.7 ), mossHeight ), constant( 0.7 ) );
	const mossColor = mix( color( 0x2c3a18 ), color( 0x44552a ), barkNoise2 );
	const barkColor = mix( barkPale, mossColor, mossWeight );
	const baseColor = choose( isBark, barkColor, leafColor );

	const coverage = binary( 'greaterThan', leafCoverage, constant( TIDEWATER_CANOPY_COVERAGE_CUTOFF ) );
	const stem = binary( 'greaterThan', part, constant( 4.5 ) );
	const barkPart = binary( 'lessThan', part, constant( 0.5 ) );
	const woodyPart = binary( 'or', barkPart, stem );
	const visiblePart = binary( 'or', coverage, woodyPart );
	const opacity = choose( visiblePart, constant( 1 ), constant( 0 ) );

	const glossyTree = binary( 'lessThan', treeSpecies, constant( 0.5 ) );
	const glossyShrub = binary( 'lessThan', shrubSpecies, constant( 0.5 ) );
	const glossyLeaves = choose( isShrub, glossyShrub, glossyTree );
	const leafRoughness = choose( glossyLeaves, constant( 0.65 ), constant( 0.82 ) );
	const roughness = choose( isBark, constant( 0.92 ), leafRoughness );
	const leafOcclusion = mix( constant( 0.35 ), constant( 1 ), ao );
	const barkOcclusion = binary( 'add', binary( 'multiply', ternary( 'smoothstep', constant( 0 ), constant( 0.75 ), heightFraction ), constant( 0.45 ) ), constant( 0.4 ) );
	const occlusion = choose( isBark, barkOcclusion, leafOcclusion );

	const normal = input( 'normal' );
	const geoNormal = unary( 'normalize', normal );
	const cameraPosition = input( 'cameraPosition' );
	const worldPosition = input( 'worldPosition' );
	const sunDirection = input( 'sunDirection' );
	const viewDirection = unary( 'normalize', binary( 'subtract', cameraPosition, worldPosition ) );
	const leafNormal = unary( 'normalize', binary( 'add', geoNormal, binary( 'multiply', viewDirection, constant( 0.7 ) ) ) );
	const surfaceNormal = choose( isBark, geoNormal, leafNormal );
	const towardSun = unary( 'normalize', binary( 'subtract', worldPosition, cameraPosition ) );
	const backFacingLight = ternary( 'clamp', binary( 'dot', binary( 'multiply', geoNormal, constant( -1 ) ), sunDirection ), constant( 0 ), constant( 1 ) );
	// Clamp the dot before pow and use the authored exponent below.
	const forwardDot = ternary( 'clamp', binary( 'dot', towardSun, sunDirection ), constant( 0 ), constant( 1 ) );
	const forward = binary( 'add', binary( 'multiply', binary( 'pow', forwardDot, constant( 3 ) ), constant( 0.7 ) ), constant( 0.3 ) );
	const leafTransmissionTint = binary( 'add', binary( 'multiply', leafColor, constant( [ 1.25, 1.45, 0.55 ] ) ), constant( [ 0.012, 0.018, 0 ] ) );
	const aoTransmission = binary( 'add', binary( 'multiply', ao, constant( 0.6 ) ), constant( 0.4 ) );
	const day = binary( 'subtract', constant( 1 ), input( 'night' ) );
	const transmissionStrength = binary( 'multiply', binary( 'multiply', binary( 'multiply', backFacingLight, forward ), constant( 0.5 ) ), binary( 'multiply', aoTransmission, day ) );
	const leafTranslucency = binary( 'multiply', leafTransmissionTint, transmissionStrength );
	const translucency = choose( isBark, constant( [ 0, 0, 0 ] ), leafTranslucency );
	const specularIntensity = constant( 0.15 );

	return Object.freeze( {
		format: 'elsemesh.material-graph/1',
		nodes: Object.freeze( nodes.map( node => Object.freeze( node ) ) ),
		outputs: Object.freeze( { baseColor, opacity, roughness, occlusion, specularIntensity, surfaceNormal, translucency, vertexPosition: deformedPosition } ),
	} );
}

export const TIDEWATER_CANOPY_MATERIAL_GRAPH = buildCanopyMaterialGraph();
