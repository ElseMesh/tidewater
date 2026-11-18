// Renderer-neutral authored palm material. The engine compiles this bounded
// graph to both graphics backends; it contains no backend shader source.

const nodes = [];
const input = ( id, name ) => ( nodes.push( { id, op: 'input', name } ), id );
const constant = ( id, value ) => ( nodes.push( { id, op: 'constant', value } ), id );
const op = ( id, operation, ...args ) => ( nodes.push( { id, op: operation, args } ), id );

function linearColor( hex ) {
	const linear = channel => {
		const value = channel / 255;
		return value <= 0.04045 ? value / 12.92 : ( ( value + 0.055 ) / 1.055 ) ** 2.4;
	};
	return [ linear( hex >> 16 & 255 ), linear( hex >> 8 & 255 ), linear( hex & 255 ) ];
}

const materialData = input( 'materialData', 'vdata1' );
const vertexData = input( 'vertexData', 'vdata' );
const uv = input( 'uv', 'uv' );
const instanceData = input( 'instanceData', 'instanceMaterial1' );
const frontFacing = input( 'frontFacing', 'frontFacing' );
const part = op( 'part', 'x', materialData );
const age = op( 'age', 'y', materialData );
const along = op( 'along', 'x', vertexData );
const around = op( 'around', 'x', uv );
const seed = op( 'seed', 'w', instanceData );
const height = op( 'height', 'z', instanceData );

// Bark rings use the same authored trunk-height and circumference streams as
// Tidewater's source mesh. The graph keeps weathering deliberately subtle.
const trunkHeight = op( 'trunkHeight', 'multiply', along, height );
const ringBaseScale = constant( 'ringBaseScale', 9.5 );
const ringBase = op( 'ringBase', 'multiply', trunkHeight, ringBaseScale );
const aroundScale = constant( 'aroundScale', 25 );
const aroundPhase = op( 'aroundPhase', 'multiply', around, aroundScale );
const seedPhaseScale = constant( 'seedPhaseScale', 2 );
const seedPhase = op( 'seedPhase', 'multiply', seed, seedPhaseScale );
const aroundSeed = op( 'aroundSeed', 'add', aroundPhase, seedPhase );
const aroundWave = op( 'aroundWave', 'sin', aroundSeed );
const wobbleScale = constant( 'wobbleScale', 0.2 );
const ringWobble = op( 'ringWobble', 'multiply', aroundWave, wobbleScale );
const ringPhase = op( 'ringPhase', 'add', ringBase, ringWobble );
const ringWave = op( 'ringWave', 'sin', ringPhase );
const half = constant( 'half', 0.5 );
const ringUnit = op( 'ringUnit', 'multiply', ringWave, half );
const ringUnitShift = constant( 'ringUnitShift', 0.5 );
const ringLight = op( 'ringLight', 'add', ringUnit, ringUnitShift );
const barkLightLow = constant( 'barkLightLow', 0.93 );
const barkLightHigh = constant( 'barkLightHigh', 1.05 );
const barkLight = op( 'barkLight', 'mix', barkLightLow, barkLightHigh, ringLight );
const seedWeatherScale = constant( 'seedWeatherScale', 37.1 );
const seedWeatherPhase = op( 'seedWeatherPhase', 'multiply', seed, seedWeatherScale );
const seedWeather = op( 'seedWeather', 'fract', seedWeatherPhase );
const weatherScale = constant( 'weatherScale', 0.25 );
const weatherVariation = op( 'weatherVariation', 'multiply', seedWeather, weatherScale );
const heightWeather = op( 'heightWeather', 'multiply', along, constant( 'heightWeatherScale', 0.15 ) );
const weatherBase = op( 'weatherBase', 'add', constant( 'weatherOffset', 0.25 ), weatherVariation );
const weather = op( 'weather', 'clamp', op( 'weatherUnclamped', 'add', weatherBase, heightWeather ), constant( 'weatherMin', 0 ), constant( 'weatherMax', 0.65 ) );
const barkDark = constant( 'barkDark', linearColor( 0x5e554a ) );
const barkSilver = constant( 'barkSilver', linearColor( 0xa49a88 ) );
const barkBase = op( 'barkBase', 'mix', barkDark, barkSilver, weather );
const bark = op( 'bark', 'multiply', barkBase, barkLight );

// Use the same portable value-noise definition on both engine backends for
// palm bark mottling. The signed GLBs retain these inputs for the generic
// static-model material path.
const barkNoiseX = op( 'barkNoiseX', 'multiply', around, constant( 'barkNoiseXScale', 90 ) );
const barkNoiseY = op( 'barkNoiseYBase', 'multiply', trunkHeight, constant( 'barkNoiseYScale', 80 ) );
const barkNoiseYSeed = op( 'barkNoiseYSeed', 'multiply', seed, constant( 'barkNoiseSeedScale', 7 ) );
const barkNoiseYCombined = op( 'barkNoiseYCombined', 'add', barkNoiseY, barkNoiseYSeed );
const barkNoiseUV = op( 'barkNoiseUV', 'vec2', barkNoiseX, barkNoiseYCombined );
const barkMottle = op( 'barkMottle', 'valueNoise2', barkNoiseUV );
const barkMottleLow = constant( 'barkMottleLow', 0.78 );
const barkMottleHigh = constant( 'barkMottleHigh', 1.08 );
const barkMottleGain = op( 'barkMottleGain', 'mix', barkMottleLow, barkMottleHigh, barkMottle );
const barkDetailed = op( 'barkDetailed', 'multiply', bark, barkMottleGain );

// Frond color ages from fresh green through olive to yellowed lower leaves.
const ageScale = constant( 'ageScale', 0.55 );
const ageRatio = op( 'ageRatio', 'divide', age, ageScale );
const ageNormalized = op( 'ageNormalized', 'clamp', ageRatio, constant( 'ageMin', 0 ), constant( 'ageMax', 1 ) );
const oldAge = op( 'oldAge', 'smoothstep', constant( 'oldAgeStart', 0 ), constant( 'oldAgeEnd', 0.35 ), ageNormalized );
const youngLeaf = constant( 'youngLeaf', linearColor( 0x728c33 ) );
const oldLeaf = constant( 'oldLeaf', linearColor( 0x445f27 ) );
const leafBase = op( 'leafBase', 'mix', youngLeaf, oldLeaf, oldAge );
const yellowAge = op( 'yellowAge', 'smoothstep', constant( 'yellowAgeStart', 0.55 ), constant( 'yellowAgeEnd', 1 ), ageNormalized );
const yellowLeaf = constant( 'yellowLeaf', linearColor( 0x69702f ) );
const agedLeaf = op( 'agedLeaf', 'mix', leafBase, yellowLeaf, yellowAge );
const leafTipShade = op( 'leafTipShade', 'smoothstep', constant( 'leafTipStart', 0.2 ), constant( 'leafTipEnd', 1 ), along );
const leafTipLight = op( 'leafTipLight', 'mix', constant( 'leafTipBright', 1.08 ), constant( 'leafTipDark', 0.86 ), leafTipShade );
const leafUpper = op( 'leafUpper', 'multiply', agedLeaf, leafTipLight );
const leafLowerTint = constant( 'leafLowerTint', [ 0.74, 0.8, 0.84 ] );
const leafLower = op( 'leafLower', 'multiply', leafUpper, leafLowerTint );
const leaf = op( 'leaf', 'select', frontFacing, leafUpper, leafLower );

// Coconut color follows the source mesh's green-to-yellow-to-brown age data.
const nutGreen = constant( 'nutGreen', linearColor( 0x68762a ) );
const nutYellow = constant( 'nutYellow', linearColor( 0x9c8a34 ) );
const nutBrown = constant( 'nutBrown', linearColor( 0x5c4122 ) );
const nutYellowAge = op( 'nutYellowAge', 'smoothstep', constant( 'nutYellowStart', 0.3 ), constant( 'nutYellowEnd', 0.7 ), age );
const nutFirstMix = op( 'nutFirstMix', 'mix', nutGreen, nutYellow, nutYellowAge );
const nutBrownAge = op( 'nutBrownAge', 'smoothstep', constant( 'nutBrownStart', 0.82 ), constant( 'nutBrownEnd', 0.95 ), age );
const nut = op( 'nut', 'mix', nutFirstMix, nutBrown, nutBrownAge );

const isStem = op( 'isStem', 'lessThan', part, constant( 'stemPartEnd', 0.5 ) );
const afterStem = op( 'afterStem', 'greaterThan', part, constant( 'afterStemStart', 0.5 ) );
const beforeFrondEnd = op( 'beforeFrondEnd', 'lessThan', part, constant( 'frondPartEnd', 1.5 ) );
const isFrond = op( 'isFrond', 'and', afterStem, beforeFrondEnd );
const afterNutStart = op( 'afterNutStart', 'greaterThan', part, constant( 'nutPartStart', 4.5 ) );
const beforeNutEnd = op( 'beforeNutEnd', 'lessThan', part, constant( 'nutPartEnd', 5.5 ) );
const isNut = op( 'isNut', 'and', afterNutStart, beforeNutEnd );
const foliageOrNut = op( 'foliageOrNut', 'select', isFrond, leaf, nut );
const baseColor = op( 'baseColor', 'select', isStem, barkDetailed, foliageOrNut );
const isLeafTransmission = op( 'isLeafTransmission', 'select', isFrond, op( 'leafTransmission', 'multiply', leafUpper, constant( 'transmissionStrength', 0.3 ) ), constant( 'noTransmission', [ 0, 0, 0 ] ) );
const leafRoughness = op( 'leafRoughness', 'select', isFrond, constant( 'frondRoughness', 0.62 ), constant( 'nutRoughness', 0.7 ) );
const foliageRoughness = op( 'foliageRoughness', 'select', isNut, constant( 'nutSurfaceRoughness', 0.7 ), leafRoughness );
const roughness = op( 'roughness', 'select', isStem, constant( 'stemRoughness', 0.92 ), foliageRoughness );

export const TIDEWATER_PALM_MATERIAL_GRAPH = Object.freeze( {
	format: 'elsemesh.material-graph/1',
	nodes: Object.freeze( nodes.map( node => Object.freeze( node ) ) ),
	outputs: Object.freeze( { baseColor, roughness, thinTransmission: isLeafTransmission } ),
} );
