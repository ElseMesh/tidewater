// Renderer-neutral material graphs authored by Tidewater and compiled by ElseMesh.
// Keep this file as graph data: it must not import a graphics backend or shader API.
const nodes = [];
const input = ( id, name ) => nodes.push( { id, op: 'input', name } );
const value = ( id, value ) => nodes.unshift( { id, op: 'constant', value } );
const op = ( id, op, ...args ) => nodes.push( { id, op, args } );

// Net placement is packed as [seed, swayWeight, netSize, 0]. These operations
// preserve the previous shared cloth/net vertex motion in both engine backends.
input( 'position', 'position' );
input( 'data', 'vdata' );
input( 'time', 'time' );
input( 'wind', 'windDirection' );
input( 'windSpeed', 'windSpeed' );
input( 'uv', 'uv' );
input( 'worldPosition', 'worldPosition' );
input( 'worldNormal', 'worldNormal' );
input( 'colorRGB', 'colorRGB' );

op( 'seed', 'x', 'data' );
op( 'weight', 'y', 'data' );
op( 'size', 'z', 'data' );
op( 'px', 'x', 'position' );
op( 'py', 'y', 'position' );
op( 'pz', 'z', 'position' );
op( 'timePhase', 'multiply', 'time', 'onePointSeven' );
op( 'phaseX', 'multiply', 'px', 'pointSix' );
op( 'phaseZ', 'multiply', 'pz', 'pointFourFive' );
op( 'phaseSeed', 'multiply', 'seed', 'twenty' );
op( 'phaseA', 'add', 'timePhase', 'phaseX' );
op( 'phaseB', 'add', 'phaseA', 'phaseZ' );
op( 'phase', 'add', 'phaseB', 'phaseSeed' );
op( 'phaseSin', 'sin', 'phase' );
op( 'gustA', 'multiply', 'phaseSin', 'pointSix' );
op( 'phaseFast', 'multiply', 'phase', 'twoPointThree' );
op( 'phaseFastOffset', 'add', 'phaseFast', 'onePointSeven' );
op( 'gustBsin', 'sin', 'phaseFastOffset' );
op( 'gustB', 'multiply', 'gustBsin', 'pointThree' );
op( 'gustSum', 'add', 'gustA', 'gustB' );
op( 'gust', 'add', 'gustSum', 'pointFiveFive' );
op( 'flutterTime', 'multiply', 'time', 'seven' );
op( 'flutterY', 'multiply', 'py', 'nine' );
op( 'flutterSeed', 'multiply', 'seed', 'fifty' );
op( 'flutterA', 'add', 'flutterTime', 'flutterY' );
op( 'flutterB', 'add', 'flutterA', 'flutterSeed' );
op( 'flutterSin', 'sin', 'flutterB' );
op( 'flutter', 'multiply', 'flutterSin', 'pointTwoFive' );
op( 'gustFlutter', 'add', 'gust', 'flutter' );
op( 'weightWind', 'multiply', 'windSpeed', 'weight' );
op( 'windFactor', 'multiply', 'weightWind', 'pointZeroOneOne' );
op( 'swayAmount', 'multiply', 'gustFlutter', 'windFactor' );
op( 'windX', 'x', 'wind' );
op( 'windY', 'y', 'wind' );
op( 'offsetX', 'multiply', 'windX', 'swayAmount' );
op( 'flutterSmall', 'multiply', 'flutter', 'pointThree' );
op( 'offsetY', 'multiply', 'flutterSmall', 'swayAmount' );
op( 'offsetZ', 'multiply', 'windY', 'swayAmount' );
op( 'offset', 'vec3', 'offsetX', 'offsetY', 'offsetZ' );
op( 'moved', 'add', 'position', 'offset' );

// Texture channels are alpha, shade, normal-X, normal-Y. Fade the knotted
// normal and alpha coverage when the strands become sub-pixel.
op( 'tileSize', 'max', 'size', 'minNetSize' );
op( 'tile', 'multiply', 'tileSize', 'four' );
op( 'tileVector', 'vec2', 'tile', 'tile' );
op( 'netUV', 'divide', 'uv', 'tileVector' );
nodes.push( { id: 'netTex', op: 'textureSample', slot: 'metallicRoughness', uv: 'netUV' } );
op( 'uvWidth', 'fwidth', 'netUV' );
op( 'uvWidthX', 'x', 'uvWidth' );
op( 'uvWidthY', 'y', 'uvWidth' );
op( 'uvWidthMax', 'max', 'uvWidthX', 'uvWidthY' );
op( 'far', 'smoothstep', 'farStart', 'farEnd', 'uvWidthMax' );
op( 'normalX', 'z', 'netTex' );
op( 'normalY', 'w', 'netTex' );
op( 'normalX2', 'multiply', 'normalX', 'two' );
op( 'normalY2', 'multiply', 'normalY', 'two' );
op( 'normalXCentered', 'subtract', 'normalX2', 'one' );
op( 'normalYCentered', 'subtract', 'normalY2', 'one' );
op( 'normalXY', 'vec2', 'normalXCentered', 'normalYCentered' );
op( 'normalDot', 'dot', 'normalXY', 'normalXY' );
op( 'normalRemainder', 'subtract', 'one', 'normalDot' );
op( 'normalDenominatorSq', 'max', 'normalRemainder', 'normalFloor' );
op( 'normalDenominator', 'sqrt', 'normalDenominatorSq' );
op( 'normalDenominator2', 'vec2', 'normalDenominator', 'normalDenominator' );
op( 'rawSlope', 'divide', 'normalXY', 'normalDenominator2' );
op( 'near', 'subtract', 'one', 'far' );
op( 'slope', 'multiply', 'rawSlope', 'near' );
op( 'surfaceNormal', 'normalFromSlope', 'worldPosition', 'worldNormal', 'uv', 'slope' );

op( 'netAlpha', 'x', 'netTex' );
op( 'alphaCoverage', 'mix', 'netAlpha', 'farCoverage', 'far' );
op( 'opacity', 'multiply', 'alphaCoverage', 'alphaFactor' );
op( 'shade', 'y', 'netTex' );
op( 'shadeFactor', 'mix', 'shadeLow', 'shadeHigh', 'shade' );
op( 'farShade', 'mix', 'shadeNear', 'shadeFar', 'far' );
op( 'albedoScalar', 'multiply', 'shadeFactor', 'farShade' );
op( 'albedo', 'vec3', 'albedoScalar', 'albedoScalar', 'albedoScalar' );
op( 'tintedAlbedo', 'multiply', 'colorRGB', 'albedo' );
value( 'netRoughness', 0.9 );
value( 'netMetalness', 0 );

for ( const [ id, value_ ] of Object.entries( {
	one: 1, two: 2, four: 4, seven: 7, nine: 9, twenty: 20, fifty: 50,
	pointSix: 0.6, pointFourFive: 0.45, pointThree: 0.3, pointTwoFive: 0.25,
	pointFiveFive: 0.55, onePointSeven: 1.7, twoPointThree: 2.3,
	pointZeroOneOne: 0.011, farStart: 0.05, farEnd: 0.1, minNetSize: 0.02,
	normalFloor: 0.04, farCoverage: 0.4, alphaFactor: 0.95,
	shadeLow: 0.5, shadeHigh: 1.05, shadeNear: 1, shadeFar: 0.85,
} ) ) value( id, value_ );

export const TIDEWATER_NET_MATERIAL_GRAPH = Object.freeze( {
	format: 'elsemesh.material-graph/1',
	nodes: Object.freeze( nodes.map( node => Object.freeze( node ) ) ),
	outputs: Object.freeze( { baseColor: 'tintedAlbedo', roughness: 'netRoughness', metalness: 'netMetalness', opacity: 'opacity', vertexPosition: 'moved', surfaceNormal: 'surfaceNormal' } ),
} );

// The source thatch material uses only authored maps, UVs, and per-vertex age/seed.
// Keep those inputs in signed glTF slots and let ElseMesh compile this same graph
// for WebGPU and WebGL.
const thatchNodes = [];
const thatchInput = ( id, name ) => thatchNodes.push( { id, op: 'input', name } );
const thatchValue = ( id, value ) => thatchNodes.unshift( { id, op: 'constant', value } );
const thatchOp = ( id, op, ...args ) => thatchNodes.push( { id, op, args } );
const thatchSample = ( id, slot, uv ) => thatchNodes.push( { id, op: 'textureSample', slot, uv } );

thatchInput( 'uv', 'uv' );
thatchInput( 'data', 'vdata' );
thatchInput( 'worldPosition', 'worldPosition' );
thatchInput( 'worldNormal', 'worldNormal' );
thatchOp( 'seed', 'x', 'data' );
thatchOp( 'age', 'y', 'data' );
thatchOp( 'u', 'y', 'uv' );
thatchOp( 'v', 'x', 'uv' );
thatchValue( 'hashXScale', 12.9898 );
thatchValue( 'hashYScale', 78.233 );
thatchValue( 'hashY', 1.3 );
thatchValue( 'hashScale', 43758.5453 );
thatchValue( 'seven', 7 );
thatchOp( 'hashX', 'multiply', 'seed', 'hashXScale' );
thatchOp( 'hashYValue', 'multiply', 'hashY', 'hashYScale' );
thatchOp( 'hashSum', 'add', 'hashX', 'hashYValue' );
thatchOp( 'hashSin', 'sin', 'hashSum' );
thatchOp( 'hashWide', 'multiply', 'hashSin', 'hashScale' );
thatchOp( 'hash', 'fract', 'hashWide' );
thatchOp( 'hashOffset', 'multiply', 'hash', 'seven' );
thatchOp( 'tu', 'add', 'u', 'hashOffset' );
thatchOp( 'tuv', 'vec2', 'tu', 'v' );
thatchSample( 'albedoMap', 'metallicRoughness', 'tuv' );
thatchSample( 'normalMap', 'normal', 'tuv' );
thatchOp( 'grimeU', 'x', 'tuv' );
thatchOp( 'grimeV', 'y', 'tuv' );
thatchValue( 'grimeUScale', 0.23 );
thatchValue( 'grimeVScale', 0.19 );
thatchValue( 'grimeUScaleFine', 0.5 );
thatchValue( 'grimeVScaleFine', 0.25 );
thatchOp( 'gmU', 'multiply', 'grimeU', 'grimeUScale' );
thatchOp( 'gmV', 'multiply', 'grimeV', 'grimeVScale' );
thatchOp( 'gmUV', 'vec2', 'gmU', 'gmV' );
thatchOp( 'seed2', 'vec2', 'seed', 'seed' );
thatchOp( 'gmUVSeed', 'add', 'gmUV', 'seed2' );
thatchSample( 'grimeMacro', 'occlusion', 'gmUVSeed' );
thatchOp( 'gsU', 'multiply', 'grimeU', 'grimeUScaleFine' );
thatchOp( 'gsV', 'multiply', 'grimeV', 'grimeVScaleFine' );
thatchOp( 'gsUV', 'vec2', 'gsU', 'gsV' );
thatchValue( 'seedFineScale', 1.7 );
thatchOp( 'seedFine', 'multiply', 'seed', 'seedFineScale' );
thatchOp( 'seedFine2', 'vec2', 'seedFine', 'seedFine' );
thatchOp( 'gsUVSeed', 'add', 'gsUV', 'seedFine2' );
thatchSample( 'grimeStreaks', 'occlusion', 'gsUVSeed' );
thatchOp( 'albedoRGB', 'rgb', 'albedoMap' );
thatchValue( 'lumaWeights', [ 0.3, 0.59, 0.11 ] );
thatchOp( 'lum', 'dot', 'albedoRGB', 'lumaWeights' );
thatchValue( 'greyTint', [ 0.95, 0.9, 0.8 ] );
thatchOp( 'greyed', 'multiply', 'greyTint', 'lum' );
thatchOp( 'gmAlpha', 'w', 'grimeMacro' );
thatchValue( 'half', 0.5 );
thatchValue( 'ageNoise', 0.9 );
thatchOp( 'gmCentered', 'subtract', 'gmAlpha', 'half' );
thatchOp( 'ageNoiseValue', 'multiply', 'gmCentered', 'ageNoise' );
thatchOp( 'ageRaw', 'add', 'age', 'ageNoiseValue' );
thatchValue( 'zero', 0 );
thatchValue( 'one', 1 );
thatchOp( 'ageL', 'clamp', 'ageRaw', 'zero', 'one' );
thatchValue( 'ageGreyScale', 0.8 );
thatchOp( 'ageGreyMix', 'multiply', 'ageL', 'ageGreyScale' );
thatchOp( 'agedColor', 'mix', 'albedoRGB', 'greyed', 'ageGreyMix' );
thatchValue( 'gmColorScale', 0.35 );
thatchValue( 'gmColorBase', 0.82 );
thatchOp( 'gmTint', 'multiply', 'gmAlpha', 'gmColorScale' );
thatchOp( 'gmTintFactor', 'add', 'gmTint', 'gmColorBase' );
thatchValue( 'ageFadeScale', 0.2 );
thatchOp( 'ageFade', 'multiply', 'ageL', 'ageFadeScale' );
thatchOp( 'ageFadeFactor', 'subtract', 'one', 'ageFade' );
thatchOp( 'agedTint', 'multiply', 'agedColor', 'gmTintFactor' );
thatchOp( 'agedAlbedo', 'multiply', 'agedTint', 'ageFadeFactor' );
thatchOp( 'streakR', 'x', 'grimeStreaks' );
thatchOp( 'streakB', 'z', 'grimeStreaks' );
thatchValue( 'streakRScale', 0.25 );
thatchValue( 'streakBScale', 0.35 );
thatchOp( 'streakRShade', 'multiply', 'streakR', 'streakRScale' );
thatchOp( 'streakBShade', 'multiply', 'streakB', 'streakBScale' );
thatchOp( 'streakRFactor', 'subtract', 'one', 'streakRShade' );
thatchOp( 'streakBFactor', 'subtract', 'one', 'streakBShade' );
thatchOp( 'streakTint', 'multiply', 'agedAlbedo', 'streakRFactor' );
thatchOp( 'streakAlbedo', 'multiply', 'streakTint', 'streakBFactor' );
thatchOp( 'normalXY', 'xy', 'normalMap' );
thatchValue( 'two', 2 );
thatchOp( 'normalScaled', 'multiply', 'normalXY', 'two' );
thatchValue( 'one2', [ 1, 1 ] );
thatchOp( 'normalSlopeBase', 'subtract', 'normalScaled', 'one2' );
thatchOp( 'normalSlopeDot', 'dot', 'normalSlopeBase', 'normalSlopeBase' );
thatchOp( 'normalRemainder', 'subtract', 'one', 'normalSlopeDot' );
thatchValue( 'normalFloor', 0.04 );
thatchOp( 'normalDenominatorSq', 'max', 'normalRemainder', 'normalFloor' );
thatchOp( 'normalDenominator', 'sqrt', 'normalDenominatorSq' );
thatchOp( 'normalDenominator2', 'vec2', 'normalDenominator', 'normalDenominator' );
thatchOp( 'normalSlope', 'divide', 'normalSlopeBase', 'normalDenominator2' );
thatchOp( 'slopeX', 'y', 'normalSlope' );
thatchOp( 'slopeY', 'x', 'normalSlope' );
thatchOp( 'swappedSlope', 'vec2', 'slopeX', 'slopeY' );
thatchOp( 'perturbedNormal', 'normalFromSlope', 'worldPosition', 'worldNormal', 'uv', 'swappedSlope' );
thatchOp( 'roughness', 'z', 'normalMap' );
thatchOp( 'occlusion', 'w', 'normalMap' );

export const TIDEWATER_THATCH_MATERIAL_GRAPH = Object.freeze( {
	format: 'elsemesh.material-graph/1',
	nodes: Object.freeze( thatchNodes.map( node => Object.freeze( node ) ) ),
	outputs: Object.freeze( { baseColor: 'streakAlbedo', roughness: 'roughness', occlusion: 'occlusion', surfaceNormal: 'perturbedNormal' } ),
} );

// Laundry, tarps, nets, and flags share this graph. Wind deformation and
// distance coverage are data operations; ElseMesh supplies both GPU backends.
const fabricNodes = [];
const fabricInput = ( id, name ) => fabricNodes.push( { id, op: 'input', name } );
const fabricValue = ( id, value ) => fabricNodes.unshift( { id, op: 'constant', value } );
const fabricOp = ( id, op, ...args ) => fabricNodes.push( { id, op, args } );
const fabricSample = ( id, slot, uv ) => fabricNodes.push( { id, op: 'textureSample', slot, uv } );

fabricInput( 'position', 'position' );
fabricInput( 'data', 'vdata' );
fabricInput( 'time', 'time' );
fabricInput( 'windDirection', 'windDirection' );
fabricInput( 'windSpeed', 'windSpeed' );
fabricInput( 'uv', 'uv' );
fabricInput( 'colorRGB', 'colorRGB' );
fabricInput( 'worldPosition', 'worldPosition' );
fabricInput( 'worldNormal', 'worldNormal' );
fabricInput( 'frontFacing', 'frontFacing' );
fabricInput( 'pixelPosition', 'pixelPosition' );
fabricOp( 'seed', 'x', 'data' );
fabricOp( 'weight', 'y', 'data' );
fabricOp( 'mode', 'z', 'data' );
fabricValue( 'one', 1 );
fabricValue( 'zero', 0 );
fabricValue( 'half', 0.5 );
fabricValue( 'flagMode', 5000 );
fabricValue( 'netThreshold', 0.001 );
fabricOp( 'isFlag', 'step', 'flagMode', 'mode' );
fabricOp( 'isNetRaw', 'step', 'netThreshold', 'mode' );
fabricOp( 'isNotFlag', 'subtract', 'one', 'isFlag' );
fabricOp( 'isNet', 'multiply', 'isNetRaw', 'isNotFlag' );

// Shared cloth sway and flag motion.
fabricOp( 'posX', 'x', 'position' );
fabricOp( 'posY', 'y', 'position' );
fabricOp( 'posZ', 'z', 'position' );
fabricOp( 'windX', 'x', 'windDirection' );
fabricOp( 'windZ', 'y', 'windDirection' );
fabricValue( 'phasePosXScale', 0.6 );
fabricValue( 'phasePosZScale', 0.45 );
fabricValue( 'phaseSeedScale', 20 );
fabricValue( 'swayTimeScale', 1.7 );
fabricOp( 'swayTime', 'multiply', 'time', 'swayTimeScale' );
fabricOp( 'phaseX', 'multiply', 'posX', 'phasePosXScale' );
fabricOp( 'phaseZ', 'multiply', 'posZ', 'phasePosZScale' );
fabricOp( 'phaseSeed', 'multiply', 'seed', 'phaseSeedScale' );
fabricOp( 'phaseA', 'add', 'swayTime', 'phaseX' );
fabricOp( 'phaseB', 'add', 'phaseA', 'phaseZ' );
fabricOp( 'phase', 'add', 'phaseB', 'phaseSeed' );
fabricOp( 'phaseSin', 'sin', 'phase' );
fabricValue( 'gustAScale', 0.6 );
fabricValue( 'gustFastScale', 2.3 );
fabricValue( 'gustFastPhase', 1.7 );
fabricValue( 'gustBScale', 0.3 );
fabricValue( 'gustBase', 0.55 );
fabricOp( 'gustA', 'multiply', 'phaseSin', 'gustAScale' );
fabricOp( 'gustFast', 'multiply', 'phase', 'gustFastScale' );
fabricOp( 'gustFastOffset', 'add', 'gustFast', 'gustFastPhase' );
fabricOp( 'gustFastSin', 'sin', 'gustFastOffset' );
fabricOp( 'gustB', 'multiply', 'gustFastSin', 'gustBScale' );
fabricOp( 'gustSum', 'add', 'gustA', 'gustB' );
fabricOp( 'gust', 'add', 'gustSum', 'gustBase' );
fabricValue( 'flutterTimeScale', 7 );
fabricValue( 'flutterPosYScale', 9 );
fabricValue( 'flutterSeedScale', 50 );
fabricValue( 'flutterScale', 0.25 );
fabricValue( 'flutterYScale', 0.3 );
fabricValue( 'windSpeedScale', 0.011 );
fabricOp( 'flutterTime', 'multiply', 'time', 'flutterTimeScale' );
fabricOp( 'flutterY', 'multiply', 'posY', 'flutterPosYScale' );
fabricOp( 'flutterSeed', 'multiply', 'seed', 'flutterSeedScale' );
fabricOp( 'flutterPhaseA', 'add', 'flutterTime', 'flutterY' );
fabricOp( 'flutterPhase', 'add', 'flutterPhaseA', 'flutterSeed' );
fabricOp( 'flutterSin', 'sin', 'flutterPhase' );
fabricOp( 'flutter', 'multiply', 'flutterSin', 'flutterScale' );
fabricOp( 'gustFlutter', 'add', 'gust', 'flutter' );
fabricOp( 'speedWeighted', 'multiply', 'windSpeed', 'weight' );
fabricOp( 'windFactor', 'multiply', 'speedWeighted', 'windSpeedScale' );
fabricOp( 'swayAmount', 'multiply', 'gustFlutter', 'windFactor' );
fabricOp( 'flutterSmall', 'multiply', 'flutter', 'flutterYScale' );
fabricOp( 'windVector', 'vec3', 'windX', 'flutterSmall', 'windZ' );
fabricOp( 'swayOffset', 'multiply', 'windVector', 'swayAmount' );
fabricOp( 'swayPosition', 'add', 'position', 'swayOffset' );
fabricOp( 'flagDirectionRaw', 'vec3', 'windX', 'zero', 'windZ' );
fabricOp( 'flagDirection', 'normalize', 'flagDirectionRaw' );
fabricOp( 'directionX', 'x', 'flagDirection' );
fabricOp( 'directionZ', 'z', 'flagDirection' );
fabricOp( 'perpX', 'multiply', 'directionZ', 'minusOne' );
fabricOp( 'perp', 'vec3', 'perpX', 'zero', 'directionX' );
fabricValue( 'minusOne', - 1 );
fabricValue( 'flagStrengthLow', 0.5 );
fabricValue( 'flagStrengthHigh', 9 );
fabricValue( 'flagTimeScale', 7.5 );
fabricValue( 'flagDistanceScale', 5 );
fabricValue( 'flagSeedScale', 30 );
fabricValue( 'flagWaveScale', 0.09 );
fabricValue( 'flagStrengthScale', 0.7 );
fabricValue( 'flagStrengthBase', 0.3 );
fabricValue( 'flagDroopScale', 0.55 );
fabricValue( 'poleOffset', 10000 );
fabricValue( 'droopHorizontalScale', 0.4 );
fabricOp( 'flagStrength', 'smoothstep', 'flagStrengthLow', 'flagStrengthHigh', 'windSpeed' );
fabricOp( 'flagTime', 'multiply', 'time', 'flagTimeScale' );
fabricOp( 'flagDistance', 'multiply', 'weight', 'flagDistanceScale' );
fabricOp( 'flagPhaseA', 'subtract', 'flagTime', 'flagDistance' );
fabricOp( 'flagSeedPhase', 'multiply', 'seed', 'flagSeedScale' );
fabricOp( 'flagPhase', 'add', 'flagPhaseA', 'flagSeedPhase' );
fabricOp( 'flagWaveSin', 'sin', 'flagPhase' );
fabricOp( 'flagWaveDistance', 'multiply', 'weight', 'flagWaveScale' );
fabricOp( 'flagStrengthMod', 'multiply', 'flagStrength', 'flagStrengthScale' );
fabricOp( 'flagStrengthModBase', 'add', 'flagStrengthMod', 'flagStrengthBase' );
fabricOp( 'flagWaveA', 'multiply', 'flagWaveSin', 'flagWaveDistance' );
fabricOp( 'flagWave', 'multiply', 'flagWaveA', 'flagStrengthModBase' );
fabricOp( 'flagWeakness', 'subtract', 'one', 'flagStrength' );
fabricOp( 'flagDroopA', 'multiply', 'flagWeakness', 'weight' );
fabricOp( 'flagDroop', 'multiply', 'flagDroopA', 'flagDroopScale' );
fabricOp( 'poleX', 'subtract', 'mode', 'poleOffset' );
fabricOp( 'flagY', 'subtract', 'posY', 'flagDroop' );
fabricOp( 'poleZ', 'w', 'data' );
fabricOp( 'flagOrigin', 'vec3', 'poleX', 'flagY', 'poleZ' );
fabricOp( 'droopHorizontal', 'multiply', 'flagDroop', 'droopHorizontalScale' );
fabricOp( 'droopHorizontalFade', 'subtract', 'one', 'droopHorizontal' );
fabricOp( 'flagDistanceFaded', 'multiply', 'weight', 'droopHorizontalFade' );
fabricOp( 'flagDownwind', 'multiply', 'flagDirection', 'flagDistanceFaded' );
fabricOp( 'flagSideways', 'multiply', 'perp', 'flagWave' );
fabricOp( 'flagPositionA', 'add', 'flagOrigin', 'flagDownwind' );
fabricOp( 'flagPosition', 'add', 'flagPositionA', 'flagSideways' );
fabricOp( 'moved', 'mix', 'swayPosition', 'flagPosition', 'isFlag' );

// Net, canvas, and pennant surface shading.
fabricValue( 'minimumNetSize', 0.02 );
fabricValue( 'netTileScale', 4 );
fabricOp( 'netSize', 'max', 'mode', 'minimumNetSize' );
fabricOp( 'tile', 'multiply', 'netSize', 'netTileScale' );
fabricOp( 'tileVector', 'vec2', 'tile', 'tile' );
fabricOp( 'netUV', 'divide', 'uv', 'tileVector' );
fabricSample( 'netTex', 'metallicRoughness', 'netUV' );
fabricOp( 'uvWidth', 'fwidth', 'netUV' );
fabricOp( 'uvWidthX', 'x', 'uvWidth' );
fabricOp( 'uvWidthY', 'y', 'uvWidth' );
fabricOp( 'uvWidthMax', 'max', 'uvWidthX', 'uvWidthY' );
fabricValue( 'farStart', 0.05 );
fabricValue( 'farEnd', 0.1 );
fabricOp( 'far', 'smoothstep', 'farStart', 'farEnd', 'uvWidthMax' );
fabricOp( 'pixelX', 'x', 'pixelPosition' );
fabricOp( 'pixelY', 'y', 'pixelPosition' );
fabricValue( 'pixelHashX', 0.06711056 );
fabricValue( 'pixelHashY', 0.00583715 );
fabricValue( 'pixelHashScale', 52.9829189 );
fabricValue( 'ditherCoverage', 0.55 );
fabricOp( 'pixelXHash', 'multiply', 'pixelX', 'pixelHashX' );
fabricOp( 'pixelYHash', 'multiply', 'pixelY', 'pixelHashY' );
fabricOp( 'pixelHashSum', 'add', 'pixelXHash', 'pixelYHash' );
fabricOp( 'pixelHashFract', 'fract', 'pixelHashSum' );
fabricOp( 'pixelHashScaled', 'multiply', 'pixelHashFract', 'pixelHashScale' );
fabricOp( 'pixelHash', 'fract', 'pixelHashScaled' );
fabricOp( 'ditheredAlpha', 'step', 'pixelHash', 'ditherCoverage' );
fabricOp( 'netAlphaRaw', 'x', 'netTex' );
fabricOp( 'netAlpha', 'mix', 'netAlphaRaw', 'ditheredAlpha', 'far' );
fabricOp( 'netShade', 'y', 'netTex' );
fabricValue( 'netShadeLow', 0.5 );
fabricValue( 'netShadeHigh', 1.05 );
fabricValue( 'netFarShade', 0.8 );
fabricOp( 'netShadeFactor', 'mix', 'netShadeLow', 'netShadeHigh', 'netShade' );
fabricOp( 'netFarShadeFactor', 'mix', 'one', 'netFarShade', 'far' );
fabricOp( 'netShadeCombined', 'multiply', 'netShadeFactor', 'netFarShadeFactor' );
fabricOp( 'netTint', 'multiply', 'colorRGB', 'netShadeCombined' );
fabricOp( 'netNormalX', 'z', 'netTex' );
fabricOp( 'netNormalY', 'w', 'netTex' );
fabricOp( 'netNormalXYRaw', 'vec2', 'netNormalX', 'netNormalY' );
fabricValue( 'two', 2 );
fabricValue( 'one2', [ 1, 1 ] );
fabricOp( 'netNormalXYScaled', 'multiply', 'netNormalXYRaw', 'two' );
fabricOp( 'netNormalXY', 'subtract', 'netNormalXYScaled', 'one2' );
fabricOp( 'netNormalDot', 'dot', 'netNormalXY', 'netNormalXY' );
fabricOp( 'netNormalRemain', 'subtract', 'one', 'netNormalDot' );
fabricValue( 'normalFloor', 0.04 );
fabricOp( 'netNormalDenominatorSq', 'max', 'netNormalRemain', 'normalFloor' );
fabricOp( 'netNormalDenominator', 'sqrt', 'netNormalDenominatorSq' );
fabricOp( 'netNormalDenominator2', 'vec2', 'netNormalDenominator', 'netNormalDenominator' );
fabricOp( 'netSlopeRaw', 'divide', 'netNormalXY', 'netNormalDenominator2' );
fabricOp( 'near', 'subtract', 'one', 'far' );
fabricOp( 'netSlope', 'multiply', 'netSlopeRaw', 'near' );
fabricValue( 'grimeScale', 0.8 );
fabricOp( 'grimeUVBase', 'multiply', 'uv', 'grimeScale' );
fabricOp( 'seedVector', 'vec2', 'seed', 'seed' );
fabricOp( 'grimeUV', 'add', 'grimeUVBase', 'seedVector' );
fabricSample( 'grimeTex', 'occlusion', 'grimeUV' );
fabricOp( 'grimeAlpha', 'w', 'grimeTex' );
fabricValue( 'weaveFrequency', 900 );
fabricValue( 'weaveFadeLow', 0.0005 );
fabricValue( 'weaveFadeHigh', 0.002 );
fabricValue( 'weaveTintScale', 0.12 );
fabricValue( 'clothFadeScale', 0.5 );
fabricValue( 'clothTintScale', 0.6 );
fabricValue( 'clothTintLift', [ 0.3, 0.3, 0.3 ] );
fabricValue( 'clothBase', 0.94 );
fabricOp( 'uvX', 'x', 'uv' );
fabricOp( 'uvY', 'y', 'uv' );
fabricOp( 'weaveUFrequency', 'multiply', 'uvX', 'weaveFrequency' );
fabricOp( 'weaveVFrequency', 'multiply', 'uvY', 'weaveFrequency' );
fabricOp( 'weaveUSin', 'sin', 'weaveUFrequency' );
fabricOp( 'weaveVSin', 'sin', 'weaveVFrequency' );
fabricOp( 'weaveUBiased', 'add', 'weaveUSin', 'one' );
fabricOp( 'weaveVBiased', 'add', 'weaveVSin', 'one' );
fabricOp( 'weaveU', 'multiply', 'weaveUBiased', 'half' );
fabricOp( 'weaveV', 'multiply', 'weaveVBiased', 'half' );
fabricOp( 'weave', 'multiply', 'weaveU', 'weaveV' );
fabricOp( 'weaveWidth', 'fwidth', 'uvX' );
fabricOp( 'weaveNear', 'smoothstep', 'weaveFadeLow', 'weaveFadeHigh', 'weaveWidth' );
fabricOp( 'weaveFine', 'subtract', 'one', 'weaveNear' );
fabricOp( 'weaveDetail', 'multiply', 'weave', 'weaveTintScale' );
fabricOp( 'weaveFiltered', 'multiply', 'weaveDetail', 'weaveFine' );
fabricOp( 'clothBrightness', 'add', 'weaveFiltered', 'clothBase' );
fabricOp( 'clothFade', 'multiply', 'grimeAlpha', 'clothFadeScale' );
fabricOp( 'clothTintDark', 'multiply', 'colorRGB', 'clothTintScale' );
fabricOp( 'clothTint', 'add', 'clothTintDark', 'clothTintLift' );
fabricOp( 'clothBaseColor', 'mix', 'colorRGB', 'clothTint', 'clothFade' );
fabricOp( 'clothColor', 'multiply', 'clothBaseColor', 'clothBrightness' );

// Pennant lighting is driven by the same wind direction and phase as its motion.
fabricValue( 'flagNormalSlopeScale', 0.45 );
fabricValue( 'flagPhaseBias', 0.2 );
fabricOp( 'flagPhaseCos', 'cos', 'flagPhase' );
fabricOp( 'flagSlopeA', 'multiply', 'flagPhaseCos', 'flagNormalSlopeScale' );
fabricOp( 'flagWeightBias', 'add', 'weight', 'flagPhaseBias' );
fabricOp( 'flagSlopeB', 'multiply', 'flagSlopeA', 'flagWeightBias' );
fabricOp( 'flagSlopeW', 'multiply', 'flagSlopeB', 'flagStrengthModBase' );
fabricOp( 'flagSlopeVec', 'multiply', 'flagDirection', 'flagSlopeW' );
fabricOp( 'flagNormalRaw', 'subtract', 'perp', 'flagSlopeVec' );
fabricOp( 'flagNormalUnit', 'normalize', 'flagNormalRaw' );
fabricOp( 'frontSign', 'select', 'frontFacing', 'one', 'minusOne' );
fabricOp( 'flagNormal', 'multiply', 'flagNormalUnit', 'frontSign' );
fabricValue( 'colorGrimeScale', 0.15 );
fabricValue( 'flagBase', 0.88 );
fabricOp( 'flagGrimeShade', 'multiply', 'grimeAlpha', 'colorGrimeScale' );
fabricOp( 'flagAlbedoFactor', 'add', 'flagGrimeShade', 'flagBase' );
fabricOp( 'flagColor', 'multiply', 'colorRGB', 'flagAlbedoFactor' );
fabricOp( 'clothNetColor', 'mix', 'clothColor', 'netTint', 'isNet' );
fabricOp( 'fabricAlbedo', 'mix', 'clothNetColor', 'flagColor', 'isFlag' );
fabricOp( 'fabricCoverage', 'mix', 'one', 'netAlpha', 'isNet' );
fabricOp( 'fabricSlope', 'multiply', 'netSlope', 'isNet' );
fabricOp( 'fabricNormal', 'normalFromSlope', 'worldPosition', 'worldNormal', 'uv', 'fabricSlope' );
fabricOp( 'fabricNormalUnit', 'normalize', 'fabricNormal' );
fabricOp( 'mixedNormal', 'mix', 'fabricNormalUnit', 'flagNormal', 'isFlag' );
fabricOp( 'surfaceNormal', 'normalize', 'mixedNormal' );

export const TIDEWATER_FABRIC_MATERIAL_GRAPH = Object.freeze( {
	format: 'elsemesh.material-graph/1',
	nodes: Object.freeze( fabricNodes.map( node => Object.freeze( node ) ) ),
	outputs: Object.freeze( { baseColor: 'fabricAlbedo', opacity: 'fabricCoverage', vertexPosition: 'moved', surfaceNormal: 'surfaceNormal' } ),
} );
