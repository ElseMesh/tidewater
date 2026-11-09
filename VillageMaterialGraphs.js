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

// Rubble, plaster, end-grain, and ground dust stay authored inputs while
// ElseMesh compiles the same surface graph for both renderers.
const stoneNodes = [];
const stoneInput = ( id, name ) => stoneNodes.push( { id, op: 'input', name } );
const stoneValue = ( id, value ) => stoneNodes.unshift( { id, op: 'constant', value } );
const stoneOp = ( id, op, ...args ) => stoneNodes.push( { id, op, args } );
const stoneSample = ( id, slot, uv ) => stoneNodes.push( { id, op: 'textureSample', slot, uv } );
const stoneHash = ( id, input, y, prefix ) => {
	stoneValue( `${prefix}XScale`, 12.9898 );
	stoneValue( `${prefix}YScale`, 78.233 );
	stoneValue( `${prefix}Scale`, 43758.5453 );
	stoneValue( `${prefix}Y`, y );
	stoneOp( `${prefix}X`, 'multiply', input, `${prefix}XScale` );
	stoneOp( `${prefix}YTerm`, 'multiply', `${prefix}Y`, `${prefix}YScale` );
	stoneOp( `${prefix}Sum`, 'add', `${prefix}X`, `${prefix}YTerm` );
	stoneOp( `${prefix}Sin`, 'sin', `${prefix}Sum` );
	stoneOp( `${prefix}Wide`, 'multiply', `${prefix}Sin`, `${prefix}Scale` );
	stoneOp( id, 'fract', `${prefix}Wide` );
};
const stoneSlope = ( id, texture, prefix ) => {
	stoneOp( `${prefix}XY`, 'xy', texture );
	stoneValue( `${prefix}Two`, 2 );
	stoneValue( `${prefix}One2`, [ 1, 1 ] );
	stoneOp( `${prefix}Scaled`, 'multiply', `${prefix}XY`, `${prefix}Two` );
	stoneOp( `${prefix}Centered`, 'subtract', `${prefix}Scaled`, `${prefix}One2` );
	stoneOp( `${prefix}Dot`, 'dot', `${prefix}Centered`, `${prefix}Centered` );
	stoneValue( `${prefix}One`, 1 );
	stoneOp( `${prefix}Remain`, 'subtract', `${prefix}One`, `${prefix}Dot` );
	stoneValue( `${prefix}Floor`, 0.04 );
	stoneOp( `${prefix}DenomSq`, 'max', `${prefix}Remain`, `${prefix}Floor` );
	stoneOp( `${prefix}Denom`, 'sqrt', `${prefix}DenomSq` );
	stoneOp( `${prefix}Denom2`, 'vec2', `${prefix}Denom`, `${prefix}Denom` );
	stoneOp( id, 'divide', `${prefix}Centered`, `${prefix}Denom2` );
};

stoneInput( 'uv', 'uv' );
stoneInput( 'data', 'vdata' );
stoneInput( 'colorRGB', 'colorRGB' );
stoneInput( 'worldPosition', 'worldPosition' );
stoneInput( 'worldNormal', 'worldNormal' );
stoneOp( 'seed', 'x', 'data' );
stoneOp( 'style', 'y', 'data' );
stoneOp( 'uvX', 'x', 'uv' );
stoneOp( 'uvY', 'y', 'uv' );
stoneValue( 'capU', 1500 );
stoneValue( 'endU', 500 );
stoneValue( 'one', 1 );
stoneValue( 'zero', 0 );
stoneValue( 'twoThousand', 2000 );
stoneValue( 'oneThousand', 1000 );
stoneOp( 'isCap', 'step', 'capU', 'uvX' );
stoneOp( 'isEndRaw', 'step', 'endU', 'uvX' );
stoneOp( 'notCap', 'subtract', 'one', 'isCap' );
stoneOp( 'isEnd', 'multiply', 'isEndRaw', 'notCap' );
stoneOp( 'capOffset', 'multiply', 'isCap', 'twoThousand' );
stoneOp( 'endOffset', 'multiply', 'isEnd', 'oneThousand' );
stoneOp( 'uOffset', 'add', 'capOffset', 'endOffset' );
stoneOp( 'uAdjusted', 'subtract', 'uvX', 'uOffset' );
stoneOp( 'uvSurface', 'vec2', 'uAdjusted', 'uvY' );
stoneOp( 'endAny', 'max', 'isCap', 'isEnd' );
stoneValue( 'rubbleEdge', 1.5 );
stoneOp( 'isRubble', 'step', 'rubbleEdge', 'style' );
stoneValue( 'plasterLow', 0.5 );
stoneValue( 'plasterHigh', 1.5 );
stoneOp( 'plasterA', 'step', 'plasterLow', 'style' );
stoneOp( 'plasterB', 'step', 'style', 'plasterHigh' );
stoneOp( 'isPlaster', 'multiply', 'plasterA', 'plasterB' );
stoneHash( 'offsetX', 'seed', 4.1, 'hashX' );
stoneHash( 'offsetY', 'seed', 7.7, 'hashY' );
stoneOp( 'offset', 'vec2', 'offsetX', 'offsetY' );
stoneValue( 'scaleRubble', 0.5 );
stoneValue( 'scaleNormal', 0.8 );
stoneOp( 'textureScale', 'mix', 'scaleRubble', 'scaleNormal', 'isRubble' );
stoneOp( 'scaledUV', 'multiply', 'uvSurface', 'textureScale' );
stoneOp( 'stoneUV', 'add', 'scaledUV', 'offset' );
stoneSample( 'stoneColorMap', 'baseColor', 'stoneUV' );
stoneSample( 'stoneNormalMap', 'normal', 'stoneUV' );
stoneOp( 'stoneColor', 'rgb', 'stoneColorMap' );
stoneOp( 'stoneColorMapAlpha', 'w', 'stoneColorMap' );
stoneOp( 'stoneAO', 'w', 'stoneNormalMap' );
stoneOp( 'stoneRoughness', 'z', 'stoneNormalMap' );
stoneValue( 'offsetScale', 3 );
stoneOp( 'offsetLarge', 'multiply', 'offset', 'offsetScale' );
stoneOp( 'plasterUV', 'add', 'uvSurface', 'offsetLarge' );
stoneValue( 'paintUScale', 0.7 );
stoneValue( 'paintVScale', 1.4 );
stoneOp( 'paintU', 'multiply', 'uvX', 'paintUScale' );
stoneOp( 'paintV', 'multiply', 'uvY', 'paintVScale' );
stoneOp( 'paintUVScaled', 'vec2', 'paintU', 'paintV' );
stoneOp( 'paintUV', 'multiply', 'plasterUV', 'paintUVScaled' );
stoneSample( 'paintNormalMap', 'metallicRoughness', 'paintUV' );
stoneOp( 'paintAlpha', 'w', 'paintNormalMap' );
stoneOp( 'paintRoughness', 'z', 'paintNormalMap' );
stoneValue( 'half', 0.5 );
stoneValue( 'grimeAlphaScale', 0.5 );
stoneOp( 'grimeUV', 'multiply', 'plasterUV', 'grimeAlphaScale' );
stoneSample( 'grimeMap', 'occlusion', 'grimeUV' );
stoneOp( 'grimeR', 'x', 'grimeMap' );
stoneOp( 'grimeB', 'z', 'grimeMap' );
stoneValue( 'plasterNoiseScale', 0.12 );
stoneOp( 'paintCentered', 'subtract', 'paintAlpha', 'half' );
stoneOp( 'plasterNoise', 'multiply', 'paintCentered', 'plasterNoiseScale' );
stoneOp( 'plasterField', 'add', 'stoneColorMapAlpha', 'plasterNoise' );
stoneValue( 'plasterMaskLow', 0.3 );
stoneValue( 'plasterMaskHigh', 0.33 );
stoneOp( 'plasterMaskRaw', 'smoothstep', 'plasterMaskLow', 'plasterMaskHigh', 'plasterField' );
stoneOp( 'plasterMask', 'multiply', 'plasterMaskRaw', 'isPlaster' );
stoneValue( 'texel', 0.0009765625 );
stoneOp( 'texelU', 'vec2', 'texel', 'zero' );
stoneOp( 'texelV', 'vec2', 'zero', 'texel' );
stoneOp( 'stoneUVPlusU', 'add', 'stoneUV', 'texelU' );
stoneOp( 'stoneUVMinusU', 'subtract', 'stoneUV', 'texelU' );
stoneOp( 'stoneUVPlusV', 'add', 'stoneUV', 'texelV' );
stoneOp( 'stoneUVMinusV', 'subtract', 'stoneUV', 'texelV' );
stoneSample( 'stoneMaskPlusU', 'baseColor', 'stoneUVPlusU' );
stoneSample( 'stoneMaskMinusU', 'baseColor', 'stoneUVMinusU' );
stoneSample( 'stoneMaskPlusV', 'baseColor', 'stoneUVPlusV' );
stoneSample( 'stoneMaskMinusV', 'baseColor', 'stoneUVMinusV' );
stoneOp( 'maskPlusUR', 'w', 'stoneMaskPlusU' );
stoneOp( 'maskMinusUR', 'w', 'stoneMaskMinusU' );
stoneOp( 'maskPlusVR', 'w', 'stoneMaskPlusV' );
stoneOp( 'maskMinusVR', 'w', 'stoneMaskMinusV' );
stoneOp( 'gradientX', 'subtract', 'maskPlusUR', 'maskMinusUR' );
stoneOp( 'gradientY', 'subtract', 'maskPlusVR', 'maskMinusVR' );
stoneValue( 'edgeWidth', 0.03 );
stoneValue( 'edgeCenter', 0.315 );
stoneValue( 'edgeZero', 0 );
stoneOp( 'edgeDelta', 'subtract', 'plasterField', 'edgeCenter' );
stoneOp( 'edgeAbs', 'abs', 'edgeDelta' );
stoneOp( 'edgeFade', 'smoothstep', 'edgeZero', 'edgeWidth', 'edgeAbs' );
stoneOp( 'edgeStrength', 'subtract', 'one', 'edgeFade' );
stoneOp( 'plasterEdge', 'multiply', 'edgeStrength', 'isPlaster' );
stoneValue( 'tintScale', 1.1 );
stoneValue( 'stoneTintMix', 0.15 );
stoneValue( 'one3', [ 1, 1, 1 ] );
stoneValue( 'oneScalar', 1 );
stoneOp( 'tintScaled', 'multiply', 'colorRGB', 'tintScale' );
stoneOp( 'tintFactor', 'mix', 'one3', 'tintScaled', 'stoneTintMix' );
stoneOp( 'stoneColorTinted', 'multiply', 'stoneColor', 'tintFactor' );
stoneValue( 'stoneAOWeight', 0.5 );
stoneOp( 'stoneAOFactor', 'mix', 'oneScalar', 'stoneAO', 'stoneAOWeight' );
stoneOp( 'stoneBaseColor', 'multiply', 'stoneColorTinted', 'stoneAOFactor' );
stoneValue( 'plasterDirtRScale', 0.3 );
stoneValue( 'plasterDirtBScale', 0.25 );
stoneValue( 'plasterGrimeScale', 0.16 );
stoneValue( 'plasterGrimeBase', 1 );
stoneOp( 'plasterDirtR', 'multiply', 'grimeR', 'plasterDirtRScale' );
stoneOp( 'plasterDirtB', 'multiply', 'grimeB', 'plasterDirtBScale' );
stoneOp( 'plasterDirtRFactor', 'subtract', 'one', 'plasterDirtR' );
stoneOp( 'plasterDirtBFactor', 'subtract', 'one', 'plasterDirtB' );
stoneOp( 'plasterGrimeCentered', 'subtract', 'paintAlpha', 'half' );
stoneOp( 'plasterGrimeVar', 'multiply', 'plasterGrimeCentered', 'plasterGrimeScale' );
stoneOp( 'plasterGrimeFactor', 'add', 'plasterGrimeBase', 'plasterGrimeVar' );
stoneOp( 'plasterColorA', 'multiply', 'colorRGB', 'plasterDirtRFactor' );
stoneOp( 'plasterColorB', 'multiply', 'plasterColorA', 'plasterDirtBFactor' );
stoneOp( 'plasterColorC', 'multiply', 'plasterColorB', 'plasterGrimeFactor' );
stoneValue( 'paintColorScale', 0.12 );
stoneValue( 'paintColorBase', 1 );
stoneOp( 'paintColorCentered', 'subtract', 'paintRoughness', 'half' );
stoneOp( 'paintColorVariation', 'multiply', 'paintColorCentered', 'paintColorScale' );
stoneOp( 'paintColorFactor', 'add', 'paintColorBase', 'paintColorVariation' );
stoneOp( 'plasterColorC2', 'multiply', 'plasterColorC', 'paintColorFactor' );
stoneValue( 'paintAOWeight', 0.6 );
stoneOp( 'paintAOFactor', 'mix', 'oneScalar', 'paintAlpha', 'paintAOWeight' );
stoneOp( 'plasterColorD', 'multiply', 'plasterColorC2', 'paintAOFactor' );
stoneValue( 'dustLow', 0.05 );
stoneValue( 'dustHigh', 0.75 );
stoneValue( 'dustMaskLow', 0.25 );
stoneValue( 'dustMaskHigh', 0.7 );
stoneValue( 'dustAmount', 0.8 );
stoneValue( 'dustDarken', 0.18 );
stoneValue( 'dustRough', 0.05 );
stoneValue( 'dustColor', [ 0.46, 0.4, 0.3 ] );
stoneOp( 'heightAboveGround', 'smoothstep', 'dustLow', 'dustHigh', 'uvY' );
stoneOp( 'lowDust', 'subtract', 'one', 'heightAboveGround' );
stoneOp( 'dustMask', 'smoothstep', 'dustMaskLow', 'dustMaskHigh', 'paintAlpha' );
stoneOp( 'dustStrengthRaw', 'multiply', 'lowDust', 'dustMask' );
stoneOp( 'dust', 'multiply', 'dustStrengthRaw', 'dustAmount' );
stoneOp( 'surfaceColorBase', 'mix', 'stoneBaseColor', 'plasterColorD', 'plasterMask' );
stoneOp( 'surfaceColorDust', 'mix', 'surfaceColorBase', 'dustColor', 'dust' );
stoneOp( 'dustDarkenAmount', 'multiply', 'lowDust', 'dustDarken' );
stoneOp( 'dustDarkenFactor', 'subtract', 'one', 'dustDarkenAmount' );
stoneOp( 'surfaceColor', 'multiply', 'surfaceColorDust', 'dustDarkenFactor' );
stoneSlope( 'stoneNormalSlope', 'stoneNormalMap', 'stoneSlope' );
stoneSlope( 'paintNormalSlope', 'paintNormalMap', 'paintSlope' );
stoneValue( 'plasterBumpScale', 2.5 );
stoneValue( 'edgeBumpScale', - 6 );
stoneOp( 'plasterSlope', 'multiply', 'paintNormalSlope', 'plasterBumpScale' );
stoneOp( 'surfaceSlopeBase', 'mix', 'stoneNormalSlope', 'plasterSlope', 'plasterMask' );
stoneOp( 'maskGradient', 'vec2', 'gradientX', 'gradientY' );
stoneOp( 'edgeGradient', 'multiply', 'maskGradient', 'plasterEdge' );
stoneOp( 'edgeSlope', 'multiply', 'edgeGradient', 'edgeBumpScale' );
stoneOp( 'surfaceSlope', 'add', 'surfaceSlopeBase', 'edgeSlope' );
stoneOp( 'surfaceNormal', 'normalFromSlope', 'worldPosition', 'worldNormal', 'uv', 'surfaceSlope' );
stoneValue( 'plasterRoughScale', 0.3 );
stoneValue( 'plasterRoughBase', 0.66 );
stoneOp( 'plasterRoughScaled', 'multiply', 'paintRoughness', 'plasterRoughScale' );
stoneOp( 'plasterRough', 'add', 'plasterRoughScaled', 'plasterRoughBase' );
stoneOp( 'surfaceRoughBase', 'mix', 'stoneRoughness', 'plasterRough', 'plasterMask' );
stoneOp( 'dustRoughAmount', 'multiply', 'dust', 'dustRough' );
stoneOp( 'surfaceRoughRaw', 'add', 'surfaceRoughBase', 'dustRoughAmount' );
stoneValue( 'roughMin', 0.05 );
stoneValue( 'roughMax', 1 );
stoneOp( 'surfaceRoughness', 'clamp', 'surfaceRoughRaw', 'roughMin', 'roughMax' );
stoneOp( 'surfaceAO', 'mix', 'stoneAO', 'paintAlpha', 'plasterMask' );

export const TIDEWATER_STONE_MATERIAL_GRAPH = Object.freeze( {
	format: 'elsemesh.material-graph/1',
	nodes: Object.freeze( stoneNodes.map( node => Object.freeze( node ) ) ),
	outputs: Object.freeze( { baseColor: 'surfaceColor', roughness: 'surfaceRoughness', occlusion: 'surfaceAO', surfaceNormal: 'surfaceNormal' } ),
} );

// Corrugated roof paint, galvanizing, replacement sheets, and rust remain
// world-authored parameters and texture channels; ElseMesh compiles the graph.
const roofNodes = [];
const roofInput = ( id, name ) => roofNodes.push( { id, op: 'input', name } );
const roofValue = ( id, value ) => roofNodes.unshift( { id, op: 'constant', value } );
const roofOp = ( id, op, ...args ) => roofNodes.push( { id, op, args } );
const roofSample = ( id, slot, uv ) => roofNodes.push( { id, op: 'textureSample', slot, uv } );
const roofHash = ( id, x, y, prefix ) => {
	roofValue( `${prefix}XScale`, 12.9898 );
	roofValue( `${prefix}YScale`, 78.233 );
	roofValue( `${prefix}Scale`, 43758.5453 );
	roofOp( `${prefix}X`, 'multiply', x, `${prefix}XScale` );
	roofOp( `${prefix}Y`, 'multiply', y, `${prefix}YScale` );
	roofOp( `${prefix}Sum`, 'add', `${prefix}X`, `${prefix}Y` );
	roofOp( `${prefix}Sin`, 'sin', `${prefix}Sum` );
	roofOp( `${prefix}Wide`, 'multiply', `${prefix}Sin`, `${prefix}Scale` );
	roofOp( id, 'fract', `${prefix}Wide` );
};
const roofSlope = ( id, sample, prefix ) => {
	roofOp( `${prefix}XY`, 'xy', sample );
	roofValue( `${prefix}Two`, 2 );
	roofValue( `${prefix}One2`, [ 1, 1 ] );
	roofOp( `${prefix}Scaled`, 'multiply', `${prefix}XY`, `${prefix}Two` );
	roofOp( `${prefix}Centered`, 'subtract', `${prefix}Scaled`, `${prefix}One2` );
	roofOp( `${prefix}Dot`, 'dot', `${prefix}Centered`, `${prefix}Centered` );
	roofValue( `${prefix}One`, 1 );
	roofOp( `${prefix}Remain`, 'subtract', `${prefix}One`, `${prefix}Dot` );
	roofValue( `${prefix}Floor`, 0.04 );
	roofOp( `${prefix}DenomSq`, 'max', `${prefix}Remain`, `${prefix}Floor` );
	roofOp( `${prefix}Denom`, 'sqrt', `${prefix}DenomSq` );
	roofOp( `${prefix}Denom2`, 'vec2', `${prefix}Denom`, `${prefix}Denom` );
	roofOp( id, 'divide', `${prefix}Centered`, `${prefix}Denom2` );
};

roofInput( 'uv', 'uv' );
roofInput( 'data', 'vdata' );
roofInput( 'colorRGB', 'colorRGB' );
roofInput( 'worldPosition', 'worldPosition' );
roofInput( 'worldNormal', 'worldNormal' );
roofOp( 'seed', 'x', 'data' );
roofOp( 'rustAmount', 'y', 'data' );
roofOp( 'galvanized', 'z', 'data' );
roofOp( 'u', 'x', 'uv' );
roofOp( 'v', 'y', 'uv' );
roofOp( 'uvWidth', 'fwidth', 'u' );
roofOp( 'uvHeight', 'fwidth', 'v' );
roofOp( 'uvFootprint', 'max', 'uvWidth', 'uvHeight' );
roofValue( 'nearLow', 0.0015 );
roofValue( 'nearHigh', 0.006 );
roofValue( 'one', 1 );
roofValue( 'zero', 0 );
roofOp( 'nearFar', 'smoothstep', 'nearLow', 'nearHigh', 'uvFootprint' );
roofOp( 'near', 'subtract', 'one', 'nearFar' );
roofValue( 'sheetSpacing', 0.84 );
roofValue( 'seedSheetScale', 13 );
roofOp( 'sheetRow', 'divide', 'v', 'sheetSpacing' );
roofOp( 'seedSheetOffset', 'multiply', 'seed', 'seedSheetScale' );
roofOp( 'sheetRaw', 'add', 'sheetRow', 'seedSheetOffset' );
roofOp( 'sheetF', 'add', 'sheetRaw', 'zero' );
roofOp( 'sheetId', 'floor', 'sheetF' );
roofValue( 'sheetSeedScale', 91 );
roofOp( 'sheetSeedY', 'multiply', 'seed', 'sheetSeedScale' );
roofHash( 'sheetRandom', 'sheetId', 'sheetSeedY', 'sheetHash' );
roofValue( 'slopeScale', 1.68 );
roofValue( 'roofTextureVScale', 5.37 );
roofOp( 'roofU', 'divide', 'u', 'slopeScale' );
roofOp( 'roofVSeed', 'multiply', 'sheetRandom', 'roofTextureVScale' );
roofOp( 'roofV', 'add', 'roofU', 'roofVSeed' );
roofOp( 'roofUV', 'vec2', 'sheetF', 'roofV' );
roofSample( 'roofChannels', 'metallicRoughness', 'roofUV' );
roofSample( 'roofNormalChannels', 'normal', 'roofUV' );
roofValue( 'macroUScale', 0.13 );
roofValue( 'macroVScale', 0.09 );
roofValue( 'seedOffsetScale', 1.7 );
roofOp( 'macroU0', 'multiply', 'sheetF', 'macroUScale' );
roofOp( 'macroU', 'add', 'macroU0', 'seed' );
roofOp( 'macroV0', 'multiply', 'roofV', 'macroVScale' );
roofOp( 'macroVSeed', 'multiply', 'seed', 'seedOffsetScale' );
roofOp( 'macroV', 'add', 'macroV0', 'macroVSeed' );
roofOp( 'macroUV', 'vec2', 'macroU', 'macroV' );
roofSample( 'roofMacro', 'metallicRoughness', 'macroUV' );
roofSample( 'hardNormalChannels', 'occlusion', 'uv' );
roofOp( 'roofRust', 'x', 'roofChannels' );
roofOp( 'roofPatch', 'y', 'roofChannels' );
roofOp( 'roofFade', 'z', 'roofChannels' );
roofOp( 'roofDirt', 'w', 'roofChannels' );
roofOp( 'macroRust', 'x', 'roofMacro' );
roofOp( 'macroFade', 'z', 'roofMacro' );
roofValue( 'eaveWidth', 0.9 );
roofOp( 'eaveRemaining', 'smoothstep', 'zero', 'eaveWidth', 'u' );
roofOp( 'eave', 'subtract', 'one', 'eaveRemaining' );
roofValue( 'replacementThreshold', 0.86 );
roofOp( 'replaced', 'step', 'replacementThreshold', 'sheetRandom' );
roofValue( 'rustBase', 0.15 );
roofValue( 'replacementRust', 0.2 );
roofValue( 'macroRustCenter', 0.4 );
roofValue( 'macroRustScale', 0.5 );
roofOp( 'rustReplacement', 'multiply', 'replaced', 'replacementRust' );
roofOp( 'rustMacroCentered', 'subtract', 'macroRust', 'macroRustCenter' );
roofOp( 'rustMacroVar', 'multiply', 'rustMacroCentered', 'macroRustScale' );
roofOp( 'rustBaseAmount', 'add', 'rustAmount', 'rustBase' );
roofOp( 'rustWithReplacement', 'add', 'rustBaseAmount', 'rustReplacement' );
roofOp( 'rustWithMacro', 'add', 'rustWithReplacement', 'rustMacroVar' );
roofOp( 'rustInput', 'clamp', 'rustWithMacro', 'zero', 'one' );
roofValue( 'rustLow', 0.62 );
roofValue( 'rustHigh', 0.23 );
roofOp( 'rustThresholdBase', 'mix', 'rustLow', 'rustHigh', 'rustInput' );
roofValue( 'eaveRustScale', 0.2 );
roofOp( 'eaveRustShift', 'multiply', 'eave', 'eaveRustScale' );
roofOp( 'rustThreshold', 'subtract', 'rustThresholdBase', 'eaveRustShift' );
roofValue( 'rustEdge', 0.04 );
roofOp( 'rustSmoothLow', 'subtract', 'rustThreshold', 'rustEdge' );
roofOp( 'rustSmoothHigh', 'add', 'rustThreshold', 'rustEdge' );
roofOp( 'rustMask', 'smoothstep', 'rustSmoothLow', 'rustSmoothHigh', 'roofRust' );
roofValue( 'fadeMapScale', 0.7 );
roofValue( 'fadeMacroScale', 0.3 );
roofOp( 'fadeMap', 'multiply', 'roofFade', 'fadeMapScale' );
roofOp( 'fadeMacroPart', 'multiply', 'macroFade', 'fadeMacroScale' );
roofOp( 'fadeRaw', 'add', 'fadeMap', 'fadeMacroPart' );
roofOp( 'fade', 'clamp', 'fadeRaw', 'zero', 'one' );
roofValue( 'paintFade', 0.55 );
roofValue( 'paintTintScale', 0.7 );
roofValue( 'paintTintLift', [ 0.12, 0.1, 0.085 ] );
roofValue( 'paintSheetScale', 0.16 );
roofValue( 'paintSheetBase', 0.9 );
roofOp( 'paintTintDark', 'multiply', 'colorRGB', 'paintTintScale' );
roofOp( 'paintTint', 'add', 'paintTintDark', 'paintTintLift' );
roofOp( 'paintMix', 'multiply', 'fade', 'paintFade' );
roofOp( 'paintColorBase', 'mix', 'colorRGB', 'paintTint', 'paintMix' );
roofOp( 'sheetBrightness', 'multiply', 'sheetRandom', 'paintSheetScale' );
roofOp( 'paintBrightness', 'add', 'sheetBrightness', 'paintSheetBase' );
roofOp( 'paintColor', 'multiply', 'paintColorBase', 'paintBrightness' );
roofValue( 'patchTint', [ 0.72, 0.68, 0.66 ] );
roofValue( 'patchLift', [ 0.03, 0.025, 0.02 ] );
roofValue( 'galvColor', [ 0.34, 0.35, 0.35 ] );
roofValue( 'galvFadeScale', 0.35 );
roofValue( 'galvBase', 0.78 );
roofOp( 'patchTinted', 'multiply', 'paintColor', 'patchTint' );
roofOp( 'patchColor', 'add', 'patchTinted', 'patchLift' );
roofOp( 'galvFade', 'multiply', 'fade', 'galvFadeScale' );
roofOp( 'galvBrightness', 'add', 'galvFade', 'galvBase' );
roofOp( 'galvColorVar', 'multiply', 'galvColor', 'galvBrightness' );
roofOp( 'paintOrPatch', 'mix', 'paintColor', 'patchColor', 'replaced' );
roofOp( 'baseColor', 'mix', 'paintOrPatch', 'galvColorVar', 'galvanized' );
roofValue( 'rustDark', [ 0.12, 0.045, 0.02 ] );
roofValue( 'rustLight', [ 0.4, 0.17, 0.065 ] );
roofOp( 'rustColor', 'mix', 'rustDark', 'rustLight', 'roofPatch' );
roofOp( 'rustedColor', 'mix', 'baseColor', 'rustColor', 'rustMask' );
roofValue( 'dirtScale', 0.45 );
roofOp( 'dirtAmount', 'multiply', 'roofDirt', 'dirtScale' );
roofOp( 'dirtFactor', 'subtract', 'one', 'dirtAmount' );
roofValue( 'normalAOWeight', 0.55 );
roofOp( 'normalAO', 'w', 'roofNormalChannels' );
roofOp( 'normalAOFactor', 'mix', 'one', 'normalAO', 'normalAOWeight' );
roofOp( 'colorWithDirt', 'multiply', 'rustedColor', 'dirtFactor' );
roofOp( 'surfaceColor', 'multiply', 'colorWithDirt', 'normalAOFactor' );
roofSlope( 'roofSlope', 'roofNormalChannels', 'roofSlope' );
roofOp( 'slopeU', 'y', 'roofSlope' );
roofOp( 'slopeV', 'x', 'roofSlope' );
roofOp( 'slopeSwizzled', 'vec2', 'slopeU', 'slopeV' );
roofSlope( 'hardSlope', 'hardNormalChannels', 'hardSlope' );
roofValue( 'rustSlopeBase', 0.2 );
roofValue( 'rustSlopeScale', 0.8 );
roofOp( 'rustSlopeExtra', 'multiply', 'rustMask', 'rustSlopeScale' );
roofOp( 'rustSlope', 'add', 'rustSlopeExtra', 'rustSlopeBase' );
roofOp( 'hardSlopeAmount', 'multiply', 'hardSlope', 'rustSlope' );
roofOp( 'slopeDetail', 'multiply', 'hardSlopeAmount', 'near' );
roofOp( 'surfaceSlope', 'add', 'slopeSwizzled', 'slopeDetail' );
roofOp( 'surfaceNormal', 'normalFromSlope', 'worldPosition', 'worldNormal', 'uv', 'surfaceSlope' );
roofValue( 'paintMetalLow', 0.04 );
roofValue( 'paintMetalHigh', 0.5 );
roofValue( 'rustRoughLow', 0.55 );
roofValue( 'rustRoughHigh', 0.42 );
roofValue( 'roughNScale', 0.4 );
roofValue( 'half', 0.5 );
roofValue( 'fadeRoughScale', 0.15 );
roofValue( 'rustRough', 0.9 );
roofValue( 'dirtRoughScale', 0.08 );
roofValue( 'roughMin', 0.05 );
roofValue( 'roughMax', 1 );
roofOp( 'paintMetal', 'mix', 'paintMetalLow', 'paintMetalHigh', 'galvanized' );
roofOp( 'metalness', 'mix', 'paintMetal', 'zero', 'rustMask' );
roofOp( 'galvRoughBase', 'mix', 'rustRoughLow', 'rustRoughHigh', 'galvanized' );
roofOp( 'normalRoughChannel', 'z', 'roofNormalChannels' );
roofOp( 'normalRoughCenter', 'subtract', 'normalRoughChannel', 'half' );
roofOp( 'normalRough', 'multiply', 'normalRoughCenter', 'roughNScale' );
roofOp( 'fadeRough', 'multiply', 'fade', 'fadeRoughScale' );
roofOp( 'baseRoughA', 'add', 'galvRoughBase', 'normalRough' );
roofOp( 'baseRough', 'add', 'baseRoughA', 'fadeRough' );
roofOp( 'rustRoughness', 'mix', 'baseRough', 'rustRough', 'rustMask' );
roofOp( 'dirtRoughness', 'multiply', 'roofDirt', 'dirtRoughScale' );
roofOp( 'roughRaw', 'add', 'rustRoughness', 'dirtRoughness' );
roofOp( 'roughness', 'clamp', 'roughRaw', 'roughMin', 'roughMax' );
roofOp( 'occlusion', 'w', 'roofNormalChannels' );

export const TIDEWATER_ROOF_METAL_MATERIAL_GRAPH = Object.freeze( {
	format: 'elsemesh.material-graph/1',
	nodes: Object.freeze( roofNodes.map( node => Object.freeze( node ) ) ),
	outputs: Object.freeze( { baseColor: 'surfaceColor', metalness: 'metalness', roughness: 'roughness', occlusion: 'occlusion', surfaceNormal: 'surfaceNormal' } ),
} );

// Rusted hardware and rope share the same vertex data and shoreline response.
const hardNodes = [];
const hardInput = ( id, name ) => hardNodes.push( { id, op: 'input', name } );
const hardValue = ( id, value ) => hardNodes.unshift( { id, op: 'constant', value } );
const hardOp = ( id, op, ...args ) => hardNodes.push( { id, op, args } );
const hardSample = ( id, slot, uv ) => hardNodes.push( { id, op: 'textureSample', slot, uv } );
const hardHash = ( id, input, y, prefix ) => {
	hardValue( `${prefix}XScale`, 12.9898 );
	hardValue( `${prefix}YScale`, 78.233 );
	hardValue( `${prefix}Scale`, 43758.5453 );
	hardValue( `${prefix}Y`, y );
	hardOp( `${prefix}X`, 'multiply', input, `${prefix}XScale` );
	hardOp( `${prefix}YTerm`, 'multiply', `${prefix}Y`, `${prefix}YScale` );
	hardOp( `${prefix}Sum`, 'add', `${prefix}X`, `${prefix}YTerm` );
	hardOp( `${prefix}Sin`, 'sin', `${prefix}Sum` );
	hardOp( `${prefix}Wide`, 'multiply', `${prefix}Sin`, `${prefix}Scale` );
	hardOp( id, 'fract', `${prefix}Wide` );
};
const hardSlope = ( id, texture, prefix ) => {
	hardOp( `${prefix}XY`, 'xy', texture );
	hardValue( `${prefix}Two`, 2 );
	hardValue( `${prefix}One2`, [ 1, 1 ] );
	hardOp( `${prefix}Scaled`, 'multiply', `${prefix}XY`, `${prefix}Two` );
	hardOp( `${prefix}Centered`, 'subtract', `${prefix}Scaled`, `${prefix}One2` );
	hardOp( `${prefix}Dot`, 'dot', `${prefix}Centered`, `${prefix}Centered` );
	hardValue( `${prefix}One`, 1 );
	hardOp( `${prefix}Remain`, 'subtract', `${prefix}One`, `${prefix}Dot` );
	hardValue( `${prefix}Floor`, 0.04 );
	hardOp( `${prefix}DenomSq`, 'max', `${prefix}Remain`, `${prefix}Floor` );
	hardOp( `${prefix}Denom`, 'sqrt', `${prefix}DenomSq` );
	hardOp( `${prefix}Denom2`, 'vec2', `${prefix}Denom`, `${prefix}Denom` );
	hardOp( id, 'divide', `${prefix}Centered`, `${prefix}Denom2` );
};

hardInput( 'uv', 'uv' );
hardInput( 'data', 'vdata' );
hardInput( 'colorRGB', 'colorRGB' );
hardInput( 'worldPosition', 'worldPosition' );
hardInput( 'worldNormal', 'worldNormal' );
hardOp( 'seed', 'x', 'data' );
hardOp( 'rustAmount', 'y', 'data' );
hardOp( 'metalFactor', 'z', 'data' );
hardOp( 'materialParam', 'w', 'data' );
hardOp( 'uvX', 'x', 'uv' );
hardOp( 'uvY', 'y', 'uv' );
hardValue( 'ropeEdge', 1.5 );
hardOp( 'isRope', 'step', 'ropeEdge', 'materialParam' );
hardHash( 'offsetX', 'seed', 2.3, 'hashX' );
hardHash( 'offsetY', 'seed', 8.9, 'hashY' );
hardOp( 'offset', 'vec2', 'offsetX', 'offsetY' );
hardOp( 'hardUV', 'add', 'uv', 'offset' );
hardSample( 'hardChannels', 'metallicRoughness', 'hardUV' );
hardSample( 'hardNormalChannels', 'normal', 'hardUV' );
hardOp( 'hardRust', 'x', 'hardChannels' );
hardOp( 'hardScratch', 'y', 'hardChannels' );
hardOp( 'hardGrime', 'z', 'hardChannels' );
hardOp( 'hardNormalAO', 'w', 'hardNormalChannels' );
hardOp( 'hardNormalRough', 'z', 'hardNormalChannels' );
hardValue( 'rustEnabledEdge', 0.001 );
hardOp( 'hasRust', 'step', 'rustEnabledEdge', 'rustAmount' );
hardValue( 'rustThresholdClean', 0.95 );
hardValue( 'rustThresholdFull', 0.3 );
hardOp( 'rustThreshold', 'mix', 'rustThresholdClean', 'rustThresholdFull', 'rustAmount' );
hardValue( 'rustEdge', 0.06 );
hardOp( 'rustLow', 'subtract', 'rustThreshold', 'rustEdge' );
hardOp( 'rustHigh', 'add', 'rustThreshold', 'rustEdge' );
hardOp( 'rustSmooth', 'smoothstep', 'rustLow', 'rustHigh', 'hardRust' );
hardValue( 'one', 1 );
hardValue( 'zero', 0 );
hardOp( 'notRust', 'subtract', 'one', 'rustSmooth' );
hardOp( 'rustMask', 'multiply', 'rustSmooth', 'hasRust' );
hardValue( 'hardGrimeScale', 0.2 );
hardValue( 'hardToneScale', 0.1 );
hardValue( 'half', 0.5 );
hardValue( 'hardToneBase', 1 );
hardOp( 'hardGrimeAmount', 'multiply', 'hardGrime', 'hardGrimeScale' );
hardOp( 'hardGrimeFactor', 'subtract', 'one', 'hardGrimeAmount' );
hardOp( 'hardToneCenter', 'subtract', 'hardRust', 'half' );
hardOp( 'hardToneVar', 'multiply', 'hardToneCenter', 'hardToneScale' );
hardOp( 'hardToneFactor', 'add', 'hardToneBase', 'hardToneVar' );
hardOp( 'hardBaseTint', 'multiply', 'colorRGB', 'hardGrimeFactor' );
hardOp( 'hardBase', 'multiply', 'hardBaseTint', 'hardToneFactor' );
hardValue( 'scratchMixScale', 0.55 );
hardOp( 'scratchRust', 'multiply', 'hardScratch', 'scratchMixScale' );
hardOp( 'scratchRustEnabled', 'multiply', 'scratchRust', 'hasRust' );
hardOp( 'scratchRustClear', 'multiply', 'scratchRustEnabled', 'notRust' );
hardValue( 'hardSteel', [ 0.3, 0.3, 0.29 ] );
hardOp( 'hardTinted', 'mix', 'hardBase', 'hardSteel', 'scratchRustClear' );
hardValue( 'rustColorLow', [ 0.12, 0.045, 0.02 ] );
hardValue( 'rustColorHigh', [ 0.4, 0.17, 0.06 ] );
hardValue( 'rustColorLowEdge', 0.3 );
hardValue( 'rustColorHighEdge', 0.9 );
hardOp( 'rustColorMix', 'smoothstep', 'rustColorLowEdge', 'rustColorHighEdge', 'hardRust' );
hardOp( 'rustColor', 'mix', 'rustColorLow', 'rustColorHigh', 'rustColorMix' );
hardOp( 'rustedHard', 'mix', 'hardTinted', 'rustColor', 'rustMask' );
hardValue( 'hardAOWeight', 0.5 );
hardOp( 'hardAOFactor', 'mix', 'one', 'hardNormalAO', 'hardAOWeight' );
hardOp( 'hardColor', 'multiply', 'rustedHard', 'hardAOFactor' );
hardValue( 'roughMin', 0.04 );
hardValue( 'roughMax', 1 );
hardValue( 'normalRoughBias', 0.5 );
hardValue( 'normalRoughScale', 0.35 );
hardValue( 'hardGrimeRoughScale', 0.15 );
hardOp( 'hardNormalRoughCenter', 'subtract', 'hardNormalRough', 'normalRoughBias' );
hardOp( 'hardNormalRoughDelta', 'multiply', 'hardNormalRoughCenter', 'normalRoughScale' );
hardOp( 'hardScratchRust', 'multiply', 'hardScratch', 'hasRust' );
hardOp( 'hardGrimeRoughDelta', 'multiply', 'hardScratchRust', 'hardGrimeRoughScale' );
hardOp( 'hardRoughBase', 'add', 'materialParam', 'hardNormalRoughDelta' );
hardOp( 'hardRoughRaw', 'subtract', 'hardRoughBase', 'hardGrimeRoughDelta' );
hardOp( 'hardRoughClamp', 'clamp', 'hardRoughRaw', 'roughMin', 'roughMax' );
hardValue( 'rustRough', 0.88 );
hardOp( 'hardRoughness', 'mix', 'hardRoughClamp', 'rustRough', 'rustMask' );
hardSlope( 'hardSlope', 'hardNormalChannels', 'normalHard' );
hardValue( 'rustSlopeScale', 0.8 );
hardValue( 'hardSlopeBase', 0.25 );
hardOp( 'hardRustSlope', 'multiply', 'rustMask', 'rustSlopeScale' );
hardOp( 'hardSlopeWeight', 'add', 'hardRustSlope', 'hardSlopeBase' );
hardOp( 'hardSurfaceSlope', 'multiply', 'hardSlope', 'hardSlopeWeight' );

hardValue( 'ropeMinusTwo', 2 );
hardValue( 'ropeMinRadius', 0.004 );
hardOp( 'ropeRadiusRaw', 'subtract', 'materialParam', 'ropeMinusTwo' );
hardOp( 'ropeRadius', 'max', 'ropeRadiusRaw', 'ropeMinRadius' );
hardValue( 'tau', 6.283185307179586 );
hardOp( 'ropeCircumference', 'multiply', 'ropeRadius', 'tau' );
hardOp( 'ropeCircumference2', 'vec2', 'ropeCircumference', 'ropeCircumference' );
hardOp( 'ropeUVScaled', 'divide', 'uv', 'ropeCircumference2' );
hardValue( 'ropeSeedScale', 3.1 );
hardOp( 'ropeSeedOffset', 'multiply', 'seed', 'ropeSeedScale' );
hardOp( 'ropeOffset', 'vec2', 'ropeSeedOffset', 'zero' );
hardOp( 'ropeUV', 'add', 'ropeUVScaled', 'ropeOffset' );
hardSample( 'ropeChannels', 'occlusion', 'ropeUV' );
hardOp( 'ropeShade', 'x', 'ropeChannels' );
hardOp( 'ropeAO', 'y', 'ropeChannels' );
hardOp( 'ropeNormalX', 'z', 'ropeChannels' );
hardOp( 'ropeNormalY', 'w', 'ropeChannels' );
hardValue( 'ropeShadeLow', 0.45 );
hardValue( 'ropeShadeHigh', 1.25 );
hardOp( 'ropeBrightness', 'mix', 'ropeShadeLow', 'ropeShadeHigh', 'ropeShade' );
hardValue( 'ropeAOMix', 0.6 );
hardOp( 'ropeAOFactor', 'mix', 'one', 'ropeAO', 'ropeAOMix' );
hardOp( 'ropeColorBase', 'multiply', 'colorRGB', 'ropeBrightness' );
hardOp( 'ropeColor', 'multiply', 'ropeColorBase', 'ropeAOFactor' );
hardValue( 'two', 2 );
hardValue( 'one2', [ 1, 1 ] );
hardValue( 'ropeSlopeFloor', 0.04 );
hardOp( 'ropeNormalXY', 'vec2', 'ropeNormalX', 'ropeNormalY' );
hardOp( 'ropeNormalScaled', 'multiply', 'ropeNormalXY', 'two' );
hardOp( 'ropeNormalCentered', 'subtract', 'ropeNormalScaled', 'one2' );
hardOp( 'ropeNormalDot', 'dot', 'ropeNormalCentered', 'ropeNormalCentered' );
hardOp( 'ropeNormalRemain', 'subtract', 'one', 'ropeNormalDot' );
hardOp( 'ropeNormalRemainMax', 'max', 'ropeNormalRemain', 'ropeSlopeFloor' );
hardOp( 'ropeNormalDenom', 'sqrt', 'ropeNormalRemainMax' );
hardOp( 'ropeNormalDenom2', 'vec2', 'ropeNormalDenom', 'ropeNormalDenom' );
hardOp( 'ropeSlope', 'divide', 'ropeNormalCentered', 'ropeNormalDenom2' );

// Shared Tidewater splash-zone response is data in the graph, not a world
// material shader or a backend-specific shoreline hook.
hardOp( 'worldX', 'x', 'worldPosition' );
hardOp( 'worldY', 'y', 'worldPosition' );
hardOp( 'worldZ', 'z', 'worldPosition' );
hardValue( 'tideXZScale', 0.7 );
hardOp( 'tideXZ', 'multiply', 'worldZ', 'tideXZScale' );
hardOp( 'tideQX', 'add', 'worldX', 'tideXZ' );
hardOp( 'tideQ', 'vec2', 'tideQX', 'worldY' );
hardValue( 'tideUScale', 0.6 );
hardValue( 'tideVScale', 1.2 );
hardOp( 'tideUVScale', 'vec2', 'tideUScale', 'tideVScale' );
hardOp( 'tideUV', 'multiply', 'tideQ', 'tideUVScale' );
hardSample( 'tideGrime', 'emissive', 'tideUV' );
hardOp( 'tideGrimeR', 'x', 'tideGrime' );
hardOp( 'tideGrimeA', 'w', 'tideGrime' );
hardValue( 'tideHalf', 0.5 );
hardValue( 'tideHeightNoiseScale', 0.3 );
hardOp( 'tideHeightCentered', 'subtract', 'tideGrimeA', 'tideHalf' );
hardOp( 'tideHeightNoise', 'multiply', 'tideHeightCentered', 'tideHeightNoiseScale' );
hardOp( 'tideY', 'add', 'worldY', 'tideHeightNoise' );
hardValue( 'wetLow', 0.3 );
hardValue( 'wetHigh', 0.75 );
hardOp( 'wetFade', 'smoothstep', 'wetLow', 'wetHigh', 'tideY' );
hardOp( 'wet', 'subtract', 'one', 'wetFade' );
hardValue( 'dampLow', 0.7 );
hardValue( 'dampHigh', 1.5 );
hardValue( 'dampScale', 0.4 );
hardOp( 'dampFade', 'smoothstep', 'dampLow', 'dampHigh', 'tideY' );
hardOp( 'dampDry', 'subtract', 'one', 'dampFade' );
hardOp( 'damp', 'multiply', 'dampDry', 'dampScale' );
hardValue( 'algaeGrimeWeight', 0.6 );
hardValue( 'algaeRustWeight', 0.4 );
hardValue( 'algaeDark', [ 0.028, 0.042, 0.02 ] );
hardValue( 'algaeLight', [ 0.11, 0.105, 0.05 ] );
hardOp( 'algaeMacro', 'multiply', 'tideGrimeA', 'algaeGrimeWeight' );
hardOp( 'algaeRust', 'multiply', 'tideGrimeR', 'algaeRustWeight' );
hardOp( 'algaeBlend', 'add', 'algaeMacro', 'algaeRust' );
hardOp( 'algaeColor', 'mix', 'algaeDark', 'algaeLight', 'algaeBlend' );
hardValue( 'barnUVScale', 3.1 );
hardOp( 'barnUV', 'multiply', 'tideQ', 'barnUVScale' );
hardSample( 'barnGrime', 'emissive', 'barnUV' );
hardOp( 'barnChannel', 'z', 'barnGrime' );
hardValue( 'barnLow', - 1.6 );
hardValue( 'barnMid', - 0.35 );
hardValue( 'barnHighLow', 0.25 );
hardValue( 'barnHigh', 0.6 );
hardValue( 'barnScale', 0.9 );
hardOp( 'barnHeightLow', 'smoothstep', 'barnLow', 'barnMid', 'tideY' );
hardOp( 'barnHeightHigh', 'smoothstep', 'barnHighLow', 'barnHigh', 'tideY' );
hardOp( 'barnHeightRemaining', 'subtract', 'one', 'barnHeightHigh' );
hardOp( 'barnRaw', 'multiply', 'barnChannel', 'barnHeightLow' );
hardOp( 'barnMask', 'multiply', 'barnRaw', 'barnHeightRemaining' );
hardValue( 'wetColor', [ 0.52, 0.5, 0.44 ] );
hardOp( 'dampRemaining', 'subtract', 'one', 'damp' );
hardOp( 'dampColor', 'multiply', 'hardColor', 'dampRemaining' );
hardOp( 'wetColorMix', 'mix', 'dampColor', 'algaeColor', 'wet' );
hardOp( 'barnBlend', 'multiply', 'barnMask', 'barnScale' );
hardOp( 'hardOrRopeColor', 'mix', 'hardColor', 'ropeColor', 'isRope' );
hardOp( 'tideDampColor', 'multiply', 'hardOrRopeColor', 'dampRemaining' );
hardOp( 'tideWetColor', 'mix', 'tideDampColor', 'algaeColor', 'wet' );
hardOp( 'tideSurfaceColor', 'mix', 'tideWetColor', 'wetColor', 'barnBlend' );
hardValue( 'ropeRoughness', 0.93 );
hardOp( 'hardOrRopeRough', 'mix', 'hardRoughness', 'ropeRoughness', 'isRope' );
hardValue( 'wetRoughness', 0.3 );
hardValue( 'wetRoughScale', 0.9 );
hardOp( 'wetRoughAmount', 'multiply', 'wet', 'wetRoughScale' );
hardOp( 'roughWet', 'mix', 'hardOrRopeRough', 'wetRoughness', 'wetRoughAmount' );
hardValue( 'dampRoughness', 0.55 );
hardOp( 'roughDamp', 'mix', 'roughWet', 'dampRoughness', 'damp' );
hardValue( 'barnRoughness', 0.9 );
hardOp( 'roughness', 'mix', 'roughDamp', 'barnRoughness', 'barnMask' );
hardOp( 'rustOrWet', 'max', 'rustMask', 'wet' );
hardOp( 'notRustOrWet', 'subtract', 'one', 'rustOrWet' );
hardOp( 'notRope', 'subtract', 'one', 'isRope' );
hardOp( 'metalClean', 'multiply', 'metalFactor', 'notRustOrWet' );
hardOp( 'metalness', 'multiply', 'metalClean', 'notRope' );
hardOp( 'surfaceSlope', 'mix', 'hardSurfaceSlope', 'ropeSlope', 'isRope' );
hardOp( 'surfaceNormal', 'normalFromSlope', 'worldPosition', 'worldNormal', 'uv', 'surfaceSlope' );
hardOp( 'occlusion', 'mix', 'hardNormalAO', 'ropeAO', 'isRope' );

export const TIDEWATER_HARD_MATERIAL_GRAPH = Object.freeze( {
	format: 'elsemesh.material-graph/1',
	nodes: Object.freeze( hardNodes.map( node => Object.freeze( node ) ) ),
	outputs: Object.freeze( { baseColor: 'tideSurfaceColor', metalness: 'metalness', roughness: 'roughness', occlusion: 'occlusion', surfaceNormal: 'surfaceNormal' } ),
} );

// Window and lantern glass are a separate material batch so the engine can
// compile this renderer-neutral appearance for both WebGPU and WebGL.
const glassNodes = [];
let glassSerial = 0;
const glassNode = ( op, fields = {} ) => {
	const id = `glass${glassSerial ++}`;
	glassNodes.push( { id, op, ...fields } );
	return id;
};
const glassInput = name => glassNode( 'input', { name } );
const glassConstants = new Map();
const glassValue = value => {
	const key = JSON.stringify( value );
	if ( glassConstants.has( key ) ) return glassConstants.get( key );
	const id = glassNode( 'constant', { value } );
	glassConstants.set( key, id );
	return id;
};
const glassOp = ( op, ...args ) => glassNode( op, { args } );
const glassTexture = ( slot, uv ) => glassNode( 'textureSample', { slot, uv } );
const gv = glassValue;
const go = glassOp;
const gadd = ( a, b ) => go( 'add', a, b );
const gsub = ( a, b ) => go( 'subtract', a, b );
const gmul = ( a, b ) => go( 'multiply', a, b );
const gdiv = ( a, b ) => go( 'divide', a, b );
const gmin = ( a, b ) => go( 'min', a, b );
const gmax = ( a, b ) => go( 'max', a, b );
const gabs = a => go( 'abs', a );
const gsin = a => go( 'sin', a );
const gfract = a => go( 'fract', a );
const gsmooth = ( a, b, x ) => go( 'smoothstep', a, b, x );
const gmix = ( a, b, t ) => go( 'mix', a, b, t );
const gvec2 = ( x, y ) => go( 'vec2', x, y );
const gvec3 = ( x, y, z ) => go( 'vec3', x, y, z );
const gh = ( x, y ) => gfract( gmul( gsin( gadd( gmul( x, gv( 12.9898 ) ), gmul( y, gv( 78.233 ) ) ) ), gv( 43758.5453 ) ) );
const goneMinus = x => gsub( gv( 1 ), x );

const glassUV = glassInput( 'uv' );
const glassData = glassInput( 'vdata' );
const glassTint = glassInput( 'colorRGB' );
const glassTime = glassInput( 'time' );
const glassNight = glassInput( 'night' );
const glassU = go( 'x', glassUV );
const glassV = go( 'y', glassUV );
const glassSeed = go( 'x', glassData );
const glassKind = go( 'y', glassData );
const glassLit = go( 'w', glassData );
const grimeUV = gadd( gmul( glassUV, gv( [ 0.45, 0.45 ] ) ), gvec2( gmul( glassSeed, gv( 3.7 ) ), gmul( glassSeed, gv( 1.3 ) ) ) );
const grime = glassTexture( 'emissive', grimeUV );
const grimeR = go( 'x', grime );
const grimeG = go( 'y', grime );
const grimeB = go( 'z', grime );
const grimeA = go( 'w', grime );
const edgeU = gmin( glassU, gsub( gv( 1 ), glassU ) );
const edgeV = gmin( glassV, gsub( gv( 1 ), glassV ) );
const edge = gmin( edgeU, edgeV );
const frameDirt = goneMinus( gsmooth( gv( 0 ), gv( 0.07 ), edge ) );
const curtainLeft = goneMinus( gsmooth( gv( 0.18 ), gv( 0.3 ), glassU ) );
const curtainRight = gsmooth( gv( 0.7 ), gv( 0.82 ), glassU );
const curtain = gmul( gadd( curtainLeft, curtainRight ), go( 'step', gv( 0.35 ), glassSeed ) );
const folds = gadd( gmul( gsin( gadd( gmul( glassU, gv( 70 ) ), gmul( glassSeed, gv( 20 ) ) ) ), gv( 0.5 ) ), gv( 0.5 ) );
const interior = gmul( gv( [ 0.012, 0.014, 0.017 ] ), gadd( gmul( grimeA, gv( 0.8 ) ), gv( 0.6 ) ) );
const curtainLight = gmul( gmul( glassTint, gv( 0.16 ) ), gadd( gmul( folds, gv( 0.4 ) ), gv( 0.6 ) ) );
let windowColor = gmix( interior, curtainLight, curtain );
windowColor = gadd( windowColor, gmul( gv( [ 0.05, 0.05, 0.045 ] ), grimeG ) );
windowColor = gadd( windowColor, gmul( gv( [ 0.03, 0.026, 0.02 ] ), gadd( grimeB, frameDirt ) ) );
const lanternColor = gmul( gmul( glassTint, gv( 0.55 ) ), goneMinus( gmul( grimeB, gv( 0.25 ) ) ) );
const isLantern = go( 'step', gv( 0.5 ), glassKind );
const surfaceColor = gmix( windowColor, lanternColor, isLantern );
const windowRough = gadd( gadd( gadd( gv( 0.035 ), gmul( grimeR, gv( 0.22 ) ) ), gmul( grimeG, gv( 0.18 ) ) ), gadd( gmul( grimeB, gv( 0.1 ) ), gmul( frameDirt, gv( 0.25 ) ) ) );
const lanternRough = gadd( gv( 0.32 ), gmul( grimeR, gv( 0.15 ) ) );
const surfaceRough = gmix( windowRough, lanternRough, isLantern );
const nightOn = gsmooth( gv( 0.15 ), gv( 0.75 ), glassNight );
const warm = gv( [ 1, 0.56, 0.24 ] );
const centerDistance = gadd( gmul( gabs( gsub( glassU, gv( 0.5 ) ) ), gv( 1.4 ) ), gabs( gsub( glassV, gv( 0.62 ) ) ) );
const center = goneMinus( gsmooth( gv( 0.1 ), gv( 0.75 ), centerDistance ) );
const windowCenterGlow = gmul( warm, gadd( gmul( center, gv( 0.6 ) ), gv( 0.5 ) ) );
const windowCurtainTint = gmul( gadd( gmul( glassTint, gv( 0.5 ) ), gmul( warm, gv( 0.5 ) ) ), gadd( gmul( folds, gv( 0.3 ) ), gv( 0.45 ) ) );
const windowGlow = gmix( windowCenterGlow, windowCurtainTint, curtain );
const windowGlowNoise = gadd( gmul( gh( glassSeed, gv( 3.1 ) ), gv( 0.5 ) ), gv( 0.75 ) );
const windowGlowScale = gmul( windowGlowNoise, gmul( gv( 3.2 ), goneMinus( gmul( grimeR, gv( 0.25 ) ) ) ) );
const finalWindowGlow = gmul( windowGlow, windowGlowScale );
const flickerA = gsin( gadd( gmul( glassTime, gv( 9 ) ), gmul( glassSeed, gv( 40 ) ) ) );
const flickerB = gsin( gadd( gmul( glassTime, gv( 5.3 ) ), gmul( glassSeed, gv( 13 ) ) ) );
const flicker = gadd( gmul( gmul( flickerA, flickerB ), gv( 0.12 ) ), gv( 0.9 ) );
const lanternGlow = gmul( gv( [ 1, 0.64, 0.3 ] ), gmul( gv( 6 ), flicker ) );
const isLit = gmax( glassLit, isLantern );
const surfaceEmissive = gmul( gmul( gmix( finalWindowGlow, lanternGlow, isLantern ), nightOn ), isLit );

export const TIDEWATER_GLASS_MATERIAL_GRAPH = Object.freeze( {
	format: 'elsemesh.material-graph/1',
	nodes: Object.freeze( glassNodes.map( node => Object.freeze( node ) ) ),
	outputs: Object.freeze( { baseColor: surfaceColor, roughness: surfaceRough, emissive: surfaceEmissive } ),
} );

// Raw and painted village timber. This graph is the renderer-neutral form of
// the former createWoodMaterial WGSL path. The four signed glTF texture slots
// are baseColor (wood albedo/chip mask), normal (wood normal/roughness/AO),
// metallicRoughness (paint normal/roughness), and occlusion (grime/weather).
const woodNodes = [];
const wi = ( id, name ) => woodNodes.push( { id, op: 'input', name } );
const wc = ( id, value ) => woodNodes.unshift( { id, op: 'constant', value } );
const wo = ( id, op, ...args ) => woodNodes.push( { id, op, args } );
const ws = ( id, slot, uv, lod = null ) => woodNodes.push( lod === null ? { id, op: 'textureSample', slot, uv } : { id, op: 'textureSampleLevel', slot, uv, lod } );

wi( 'woodTint', 'colorRGB' ); wi( 'woodData', 'vdata' ); wi( 'woodUV', 'uv' );
wi( 'woodWorldPosition', 'worldPosition' ); wi( 'woodWorldNormal', 'worldNormal' );
const woodConstants = {
	zero: 0, one: 1, c1: 1, two: 2, three: 3, four: 4, half: 0.5, quarter: 0.25, e: 0.0009765625,
	tau: 6.283185307179586, c001: 0.001, c0012: 0.0012, c0015: 0.0015, c002: 0.002, c003: 0.003, c004: 0.004, c0045: 0.0045, c005: 0.005, c0075: 0.0075, c0155: 0.155, c155: 0.155, c395: 0.395,
	c007: 0.007, c008: 0.008, c009: 0.009, c012: 0.012, c014: 0.014, c015: 0.015, c08: 0.08, c06: 0.06,
	c018: 0.018, c02: 0.02, c025: 0.025, c03: 0.03, c035: 0.035, c04: 0.04, c045: 0.045,
	c05: 0.05, c06: 0.06, c07: 0.07, c09: 0.09, c10: 0.1, c11: 0.11, c12: 0.12, c14: 0.14,
	c16: 0.16, c18: 0.18, c2: 0.2, c22: 0.22, c25: 0.25, c28: 0.28, c3: 0.3, c32: 0.32,
	c35: 0.35, c37: 0.37, c4: 0.4, c42: 0.42, c45: 0.45, c5: 0.5, c55: 0.55, c6: 0.6,
	c61: 0.61, c62: 0.62, c64: 0.64, c65: 0.65, c66: 0.66, c7: 0.7, c71: 0.71, c75: 0.75,
	c77: 0.77, c78: 0.78, c79: 0.79, c8: 0.8, c82: 0.82, c84: 0.84, c85: 0.85, c86: 0.86,
	c9: 0.9, c92: 0.92, c93: 0.93, c95: 0.95, c102: 1.02, c103: 1.03, c104: 1.04, c105: 1.05, c105m: 0.105,
	cminus1: -1, cminus2: -2, c24neg: -2.4, c014neg: -0.14, cminus05: -0.5, cminus9: -9,
	c12: 1.2, c12m: 0.12, c126: 1.26, c13: 1.3, c135: 1.35, c138: 1.38, c15: 1.5, c15m: 0.15, c2x: 2, c23: 2.3,
	c26: 2.6, c3x: 3, c31: 3.1, c37x: 3.7, c42x: 4.2, c5mul: 5, c51: 5.1, c53: 5.3, c61x: 6.1,
	c713: 7.13, c77x: 7.7, c923: 9.23, c12x: 12, c131: 131, c43758: 43758.5453, c129898: 12.9898, c78233: 78.233, c17: 1.7, c33: 3.3, c47: 4.7, c1024: 1024,
	capSentinel: 1500, endSentinel: 500, capUVOffset: 2000, endUVOffset: 1000,
	woodWarm: [ 1.26, 1.02, 0.78 ], woodEndWarm: [ 1.3, 1, 0.7 ], woodPaintWarm: [ 0.86, 0.84, 0.77 ], woodWhitePoint: [ 1.2, 1.2, 1.2 ],
	chalkRGB: [ 0.27, 0.265, 0.25 ], stainRGB: [ 0.04, 0.032, 0.028 ], saltRGB: [ 0.62, 0.61, 0.57 ],
	splashRGB: [ 0.78, 0.9, 0.62 ], troddenRGB: [ 0.8, 0.76, 0.72 ], rustRGB: [ 1.04, 0.78, 0.6 ],
	dropLowRGB: [ 0.62, 0.61, 0.56 ], dropHighRGB: [ 0.8, 0.79, 0.74 ],
	lumaRGB: [ 0.3, 0.59, 0.11 ],
};
for ( const [ id, value ] of Object.entries( woodConstants ) ) wc( `wood_${id}`, value );

wo( 'woodSeed', 'x', 'woodData' ); wo( 'woodPaint', 'y', 'woodData' ); wo( 'woodPattern', 'z', 'woodData' ); wo( 'woodWeather', 'w', 'woodData' );
wo( 'woodU', 'x', 'woodUV' ); wo( 'woodV', 'y', 'woodUV' );
wo( 'woodEVectorX', 'vec2', 'wood_e', 'wood_zero' ); wo( 'woodEVectorY', 'vec2', 'wood_zero', 'wood_e' );
wo( 'woodIsCap', 'step', 'wood_capSentinel', 'woodU' ); wo( 'woodEndAt', 'step', 'wood_endSentinel', 'woodU' );
wo( 'woodNotCap', 'subtract', 'wood_one', 'woodIsCap' ); wo( 'woodIsEnd', 'multiply', 'woodEndAt', 'woodNotCap' );
wo( 'woodEndAny', 'max', 'woodIsCap', 'woodIsEnd' ); wo( 'woodCapOffset', 'multiply', 'woodIsCap', 'wood_capUVOffset' );
wo( 'woodEndOffset', 'multiply', 'woodIsEnd', 'wood_endUVOffset' ); wo( 'woodUVOffset', 'add', 'woodCapOffset', 'woodEndOffset' );
wo( 'woodUSurface', 'subtract', 'woodU', 'woodUVOffset' ); wo( 'woodSurfaceUV', 'vec2', 'woodUSurface', 'woodV' );
wo( 'woodFootprint', 'fwidth', 'woodSurfaceUV' ); wo( 'woodFootX', 'x', 'woodFootprint' ); wo( 'woodFootY', 'y', 'woodFootprint' );
wo( 'woodPixelFootprint', 'max', 'woodFootX', 'woodFootY' ); wo( 'woodNearFade', 'smoothstep', 'wood_c0012', 'wood_c005', 'woodPixelFootprint' );
wo( 'woodNear', 'subtract', 'wood_one', 'woodNearFade' );

// pattern masks are vlmBand01(pattern, integer), with exact half-unit edges.
for ( const [ name, k ] of [ [ 'Lap', 1 ], [ 'Batten', 2 ], [ 'Tongue', 3 ], [ 'Louver', 4 ], [ 'UPlank', 5 ], [ 'Horizontal', 6 ] ] ) {
	const mid = `woodBand${name}`; wc( `${mid}Lo`, k - 0.5 ); wc( `${mid}Hi`, k + 0.5 );
	wo( `${mid}A`, 'step', `${mid}Lo`, 'woodPattern' ); wo( `${mid}B`, 'step', 'woodPattern', `${mid}Hi` ); wo( `woodM${name}`, 'multiply', `${mid}A`, `${mid}B` );
}
wc( 'woodNailThreshold', 6.5 ); wo( 'woodMNail', 'step', 'woodNailThreshold', 'woodPattern' );
wo( 'woodIsVertical', 'add', 'woodMBatten', 'woodMTongue' );
	wo( 'woodSurfaceV', 'y', 'woodSurfaceUV' ); wo( 'woodUVSwap', 'vec2', 'woodSurfaceV', 'woodUSurface' );
wo( 'woodG', 'mix', 'woodSurfaceUV', 'woodUVSwap', 'woodIsVertical' );
wo( 'woodBoardLap', 'divide', 'woodV', 'wood_c2' ); wo( 'woodBoardLapFloor', 'floor', 'woodBoardLap' ); wo( 'woodBoardLapIndex', 'multiply', 'woodBoardLapFloor', 'woodMLap' );
wo( 'woodBoardHz', 'divide', 'woodV', 'wood_c16' ); wo( 'woodBoardHzFloor', 'floor', 'woodBoardHz' ); wo( 'woodBoardHzIndex', 'multiply', 'woodBoardHzFloor', 'woodMHorizontal' );
wo( 'woodBoardBB', 'divide', 'woodU', 'wood_c42' ); wo( 'woodBoardBBFloor', 'floor', 'woodBoardBB' ); wo( 'woodBoardBBIndex', 'multiply', 'woodBoardBBFloor', 'woodMBatten' );
wo( 'woodBoardTG', 'divide', 'woodU', 'wood_c14' ); wo( 'woodBoardTGFloor', 'floor', 'woodBoardTG' ); wo( 'woodBoardTGIndex', 'multiply', 'woodBoardTGFloor', 'woodMTongue' );
wo( 'woodBoardPk', 'divide', 'woodV', 'wood_c105m' ); wo( 'woodBoardPkFloor', 'floor', 'woodBoardPk' ); wo( 'woodBoardPkIndex', 'multiply', 'woodBoardPkFloor', 'woodMUPlank' );
wo( 'woodBoardIndexA', 'add', 'woodBoardLapIndex', 'woodBoardHzIndex' ); wo( 'woodBoardIndexB', 'add', 'woodBoardBBIndex', 'woodBoardTGIndex' );
wo( 'woodBoardIndexC', 'add', 'woodBoardIndexA', 'woodBoardIndexB' ); wo( 'woodBoardIndex', 'add', 'woodBoardIndexC', 'woodBoardPkIndex' );
wo( 'woodSeedScaled', 'multiply', 'woodSeed', 'wood_c131' ); wo( 'woodBoardScaled', 'multiply', 'woodBoardIndex', 'wood_c713' );
wo( 'woodPieceSeed', 'add', 'woodSeedScaled', 'woodBoardScaled' );
wo( 'woodHashX1', 'multiply', 'woodPieceSeed', 'wood_c129898' ); wo( 'woodHashY1', 'multiply', 'wood_c17', 'wood_c78233' );
wo( 'woodHashSinArg1', 'add', 'woodHashX1', 'woodHashY1' ); wo( 'woodHashSin1', 'sin', 'woodHashSinArg1' );
wo( 'woodHashWide1', 'multiply', 'woodHashSin1', 'wood_c43758' ); wo( 'woodHash1', 'fract', 'woodHashWide1' );
wo( 'woodHashX2', 'multiply', 'woodPieceSeed', 'wood_c129898' ); wo( 'woodHashY2', 'multiply', 'wood_c923', 'wood_c78233' );
wo( 'woodHashSinArg2', 'add', 'woodHashX2', 'woodHashY2' ); wo( 'woodHashSin2', 'sin', 'woodHashSinArg2' );
wo( 'woodHashWide2', 'multiply', 'woodHashSin2', 'wood_c43758' ); wo( 'woodHash2', 'fract', 'woodHashWide2' );
wo( 'woodOff', 'vec2', 'woodHash1', 'woodHash2' ); wo( 'woodGrainScale', 'vec2', 'wood_half', 'wood_one' );
wo( 'woodGrainUV', 'multiply', 'woodG', 'woodGrainScale' ); wo( 'woodTUV', 'add', 'woodGrainUV', 'woodOff' );
ws( 'woodA', 'baseColor', 'woodTUV' ); ws( 'woodN', 'metallicRoughness', 'woodTUV' );
wo( 'woodDetailUVScale', 'vec2', 'wood_three', 'wood_four' ); wo( 'woodDetailUV0', 'multiply', 'woodTUV', 'woodDetailUVScale' );
wc( 'woodDetailOffset', [ 0.37, 0.61 ] ); wo( 'woodDetailUV', 'add', 'woodDetailUV0', 'woodDetailOffset' ); ws( 'woodD', 'metallicRoughness', 'woodDetailUV' );
wo( 'woodGrimeUV0', 'multiply', 'woodSurfaceUV', 'wood_half' ); wo( 'woodOffYX', 'vec2', 'woodHash2', 'woodHash1' );
wo( 'woodOffHalf', 'multiply', 'woodOffYX', 'wood_half' ); wo( 'woodGrimeUV', 'add', 'woodGrimeUV0', 'woodOffHalf' ); ws( 'woodGm', 'emissive', 'woodGrimeUV' );
wo( 'woodMacroUV0', 'multiply', 'woodSurfaceUV', 'wood_c007' ); wo( 'woodMacroSeedX', 'multiply', 'woodSeed', 'wood_c37' ); wo( 'woodMacroSeedY', 'multiply', 'woodSeed', 'wood_c71' );
wo( 'woodMacroSeed', 'vec2', 'woodMacroSeedX', 'woodMacroSeedY' ); wo( 'woodMacroUV', 'add', 'woodMacroUV0', 'woodMacroSeed' ); ws( 'woodMacro', 'emissive', 'woodMacroUV' ); wo( 'woodMacroV', 'w', 'woodMacro' );
wo( 'woodStreakUVScale', 'vec2', 'wood_c035', 'wood_c55' ); wo( 'woodStreakUV0', 'multiply', 'woodG', 'woodStreakUVScale' );
wo( 'woodStreakOff', 'multiply', 'woodOff', 'wood_half' ); wo( 'woodStreakUV', 'add', 'woodStreakUV0', 'woodStreakOff' ); ws( 'woodGs', 'emissive', 'woodStreakUV' ); wo( 'woodGsA', 'w', 'woodGs' );
wo( 'woodHasPaint', 'step', 'wood_c001', 'woodPaint' ); wo( 'woodRawK', 'subtract', 'wood_one', 'woodHasPaint' );
// End grain uses the source's polar remap and explicit mip selection.
const woodHash = ( prefix, x, y ) => {
	wo( `${prefix}HashX`, 'multiply', x, 'wood_c129898' ); wo( `${prefix}HashY`, 'multiply', y, 'wood_c78233' );
	wo( `${prefix}HashSum`, 'add', `${prefix}HashX`, `${prefix}HashY` ); wo( `${prefix}HashSin`, 'sin', `${prefix}HashSum` );
	wo( `${prefix}HashWide`, 'multiply', `${prefix}HashSin`, 'wood_c43758' ); wo( `${prefix}Hash`, 'fract', `${prefix}HashWide` );
	return `${prefix}Hash`;
};
const woodPithHashX = woodHash( 'woodPithHX', 'woodSeed', 'wood_c53' ); const woodPithHashY = woodHash( 'woodPithHY', 'woodSeed', 'wood_c61x' );
wo( 'woodPithSideX0', 'multiply', woodPithHashX, 'wood_c4' ); wo( 'woodPithSideX', 'subtract', 'woodPithSideX0', 'wood_c6' );
wo( 'woodPithSideY0', 'multiply', woodPithHashY, 'wood_c3' ); wo( 'woodPithSideY', 'add', 'woodPithSideY0', 'wood_c25' ); wo( 'woodPithSide', 'vec2', 'woodPithSideX', 'woodPithSideY' );
const woodPithCapHX = woodHash( 'woodPithCHX', 'woodSeed', 'wood_c31' ); const woodPithCapHY = woodHash( 'woodPithCHY', 'woodSeed', 'wood_c47' );
wo( 'woodPithCapX0', 'subtract', woodPithCapHX, 'wood_half' ); wo( 'woodPithCapX1', 'multiply', 'woodPithCapX0', 'wood_c02' );
wo( 'woodPithCapY0', 'subtract', woodPithCapHY, 'wood_half' ); wo( 'woodPithCapY1', 'multiply', 'woodPithCapY0', 'wood_c02' ); wo( 'woodPithCap', 'vec2', 'woodPithCapX1', 'woodPithCapY1' );
wo( 'woodPith', 'mix', 'woodPithSide', 'woodPithCap', 'woodIsCap' );
wo( 'woodEndVector', 'subtract', 'woodSurfaceUV', 'woodPith' ); wo( 'woodEndRadius', 'length', 'woodEndVector' );
wo( 'woodEndY', 'y', 'woodEndVector' ); wo( 'woodEndX', 'x', 'woodEndVector' ); wo( 'woodEndAngle', 'atan2', 'woodEndY', 'woodEndX' );
wo( 'woodEndAngleTurns', 'divide', 'woodEndAngle', 'wood_tau' ); wo( 'woodEndAngleTile', 'multiply', 'woodEndAngleTurns', 'wood_three' );
wo( 'woodEndU', 'add', 'woodEndAngleTile', 'woodHash1' ); wo( 'woodEndUV', 'vec2', 'woodEndU', 'woodEndRadius' );
wo( 'woodRadiusWidth', 'fwidth', 'woodEndRadius' ); wo( 'woodRadiusTexels', 'multiply', 'woodRadiusWidth', 'wood_c1024' );
wo( 'woodRadiusSafe', 'max', 'woodRadiusTexels', 'wood_one' ); wo( 'woodEndLod', 'log2', 'woodRadiusSafe' ); ws( 'woodEndA', 'baseColor', 'woodEndUV', 'woodEndLod' );

// Weathered timber tone, end grain, paint film, chips, and paint normal.
wo( 'woodWeatherNoise', 'subtract', 'woodMacroV', 'wood_half' ); wo( 'woodWeatherNoiseScale', 'multiply', 'woodWeatherNoise', 'wood_c35' );
wo( 'woodWeatherRaw', 'add', 'woodWeather', 'woodWeatherNoiseScale' ); wo( 'woodW', 'clamp', 'woodWeatherRaw', 'wood_zero', 'wood_one' );
wo( 'woodPaintWeatherMix', 'mix', 'wood_one', 'wood_c6', 'woodHasPaint' ); wo( 'woodWx', 'multiply', 'woodW', 'woodPaintWeatherMix' );
wo( 'woodASideRGB', 'rgb', 'woodA' ); wo( 'woodAEndRGB', 'rgb', 'woodEndA' );
wo( 'woodASideWarm', 'multiply', 'woodASideRGB', 'wood_woodWarm' ); wo( 'woodASideWarm104', 'multiply', 'woodASideWarm', 'wood_c104' );
wo( 'woodSideWeatherFade', 'smoothstep', 'wood_c12', 'wood_c6', 'woodWx' ); wo( 'woodSideCol', 'mix', 'woodASideWarm104', 'woodASideRGB', 'woodSideWeatherFade' );
wo( 'woodEndWarm', 'multiply', 'woodAEndRGB', 'wood_woodEndWarm' ); wo( 'woodEndWeather', 'mix', 'woodEndWarm', 'woodAEndRGB', 'woodW' );
wo( 'woodEndCol', 'multiply', 'woodEndWeather', 'wood_c66' ); wo( 'woodWoodBase', 'mix', 'woodSideCol', 'woodEndCol', 'woodEndAny' );
wo( 'woodPaintTone', 'mix', 'woodTint', 'wood_woodWhitePoint', 'woodHasPaint' );
wo( 'woodBoardHashX', 'multiply', 'woodPieceSeed', 'wood_c129898' ); wo( 'woodBoardHashY', 'multiply', 'wood_c33', 'wood_c78233' );
wo( 'woodBoardHashSum', 'add', 'woodBoardHashX', 'woodBoardHashY' ); wo( 'woodBoardHashSin', 'sin', 'woodBoardHashSum' );
wo( 'woodBoardHashWide', 'multiply', 'woodBoardHashSin', 'wood_c43758' ); wo( 'woodBoardHash', 'fract', 'woodBoardHashWide' );
wo( 'woodBoardToneNoise', 'subtract', 'woodBoardHash', 'wood_half' ); wo( 'woodBoardTone', 'multiply', 'woodBoardToneNoise', 'wood_c16' );
wo( 'woodGsCentered', 'subtract', 'woodGsA', 'wood_half' ); wo( 'woodGsTone', 'multiply', 'woodGsCentered', 'wood_c14' );
wo( 'woodToneSeed', 'add', 'woodBoardTone', 'woodGsTone' ); wo( 'woodToneScale', 'multiply', 'woodToneSeed', 'woodRawK' );
wo( 'woodMacroScale', 'multiply', 'woodMacroV', 'wood_c2' ); wo( 'woodMacroBase', 'add', 'woodMacroScale', 'wood_c9' );
wo( 'woodRawTone', 'add', 'wood_one', 'woodToneScale' ); wo( 'woodToneFactor', 'multiply', 'woodMacroBase', 'woodRawTone' );
wo( 'woodWoodToneTint', 'multiply', 'woodWoodBase', 'woodPaintTone' ); wo( 'woodBaseAlbedo', 'multiply', 'woodWoodToneTint', 'woodToneFactor' );

// Chipped paint mask and paint film response.
wo( 'woodChip', 'w', 'woodA' );
wo( 'woodLapFraction0', 'divide', 'woodV', 'wood_c2' ); wo( 'woodLapFraction', 'fract', 'woodLapFraction0' );
wo( 'woodLapEdgeSmooth', 'smoothstep', 'wood_zero', 'wood_c18', 'woodLapFraction' ); wo( 'woodLapEdgeRaw', 'subtract', 'wood_one', 'woodLapEdgeSmooth' );
wo( 'woodLapEdge', 'multiply', 'woodLapEdgeRaw', 'woodMLap' );
wo( 'woodLowWallSmooth', 'smoothstep', 'wood_zero', 'wood_c7', 'woodV' ); wo( 'woodLowWall', 'subtract', 'wood_one', 'woodLowWallSmooth' );
wo( 'woodWallAB', 'add', 'woodMLap', 'woodMBatten' ); wo( 'woodWall', 'add', 'woodWallAB', 'woodMTongue' ); wo( 'woodLowWallFactor', 'multiply', 'woodLowWall', 'woodWall' );
wo( 'woodPaintOffset', 'subtract', 'woodPaint', 'wood_c4' ); wo( 'woodPaintOffsetScale', 'multiply', 'woodPaintOffset', 'wood_c32' );
wo( 'woodChipBase', 'subtract', 'wood_c395', 'woodPaintOffsetScale' ); wo( 'woodLapThresholdOffset', 'multiply', 'woodLapEdge', 'wood_c05' );
wo( 'woodLowThresholdOffset', 'multiply', 'woodLowWallFactor', 'wood_c05' ); wo( 'woodChipThresholdA', 'add', 'woodChipBase', 'woodLapThresholdOffset' );
wo( 'woodChipThresholdRaw', 'add', 'woodChipThresholdA', 'woodLowThresholdOffset' ); wo( 'woodChipThreshold', 'clamp', 'woodChipThresholdRaw', 'wood_c15m', 'wood_c55' );
wo( 'woodChipLow', 'subtract', 'woodChipThreshold', 'wood_c012' ); wo( 'woodChipHigh', 'add', 'woodChipThreshold', 'wood_c012' );
wo( 'woodPaintCoverage', 'smoothstep', 'woodChipLow', 'woodChipHigh', 'woodChip' ); wo( 'woodNoEndGrain', 'subtract', 'wood_one', 'woodEndAny' );
wo( 'woodPaintCoveragePaint', 'multiply', 'woodPaintCoverage', 'woodHasPaint' ); wo( 'woodPainted', 'multiply', 'woodPaintCoveragePaint', 'woodNoEndGrain' );
wo( 'woodChipXp', 'add', 'woodTUV', 'woodEVectorX' ); wo( 'woodChipXm', 'subtract', 'woodTUV', 'woodEVectorX' );
wo( 'woodChipYp', 'add', 'woodTUV', 'woodEVectorY' ); wo( 'woodChipYm', 'subtract', 'woodTUV', 'woodEVectorY' );
ws( 'woodChipAXp', 'baseColor', 'woodChipXp' ); ws( 'woodChipAXm', 'baseColor', 'woodChipXm' );
ws( 'woodChipAYp', 'baseColor', 'woodChipYp' ); ws( 'woodChipAYm', 'baseColor', 'woodChipYm' );
wo( 'woodChipAXpA', 'w', 'woodChipAXp' ); wo( 'woodChipAXmA', 'w', 'woodChipAXm' ); wo( 'woodChipAYpA', 'w', 'woodChipAYp' ); wo( 'woodChipAYmA', 'w', 'woodChipAYm' );
wo( 'woodChipDX', 'subtract', 'woodChipAXpA', 'woodChipAXmA' ); wo( 'woodChipDY', 'subtract', 'woodChipAYpA', 'woodChipAYmA' );
wo( 'woodEdgeDistance', 'subtract', 'woodChip', 'woodChipThreshold' ); wo( 'woodEdgeAbs', 'abs', 'woodEdgeDistance' );
wo( 'woodEdgeFade', 'smoothstep', 'wood_zero', 'wood_c025', 'woodEdgeAbs' ); wo( 'woodEdgeNear', 'subtract', 'wood_one', 'woodEdgeFade' );
wo( 'woodEdgePaint', 'multiply', 'woodEdgeNear', 'woodHasPaint' ); wo( 'woodEdgePaintNear', 'multiply', 'woodEdgePaint', 'woodNear' );
wo( 'woodEdgeGradient', 'vec2', 'woodChipDX', 'woodChipDY' ); wo( 'woodEdgeSlopeScaled', 'multiply', 'woodEdgeGradient', 'woodEdgePaintNear' );
wo( 'woodEdgeSlope', 'multiply', 'woodEdgeSlopeScaled', 'wood_cminus9' );
wo( 'woodPaintNScale', 'vec2', 'wood_one', 'wood_two' ); wo( 'woodPaintNUV0', 'multiply', 'woodG', 'woodPaintNScale' );
wo( 'woodPaintNOffset', 'multiply', 'woodOff', 'wood_c37x' ); wo( 'woodPaintNUV', 'add', 'woodPaintNUV0', 'woodPaintNOffset' ); ws( 'woodP', 'normal', 'woodPaintNUV' );
wo( 'woodPB', 'z', 'woodP' );

// Grime fading, chalky paint, and paint aging.
wo( 'woodGrimeA', 'w', 'woodGm' ); wo( 'woodGrimeR', 'x', 'woodGm' ); wo( 'woodGrimeG', 'y', 'woodGm' ); wo( 'woodGrimeB', 'z', 'woodGm' );
wo( 'woodFadeGm', 'multiply', 'woodGrimeA', 'wood_c55' ); wo( 'woodFadeW', 'multiply', 'woodW', 'wood_c25' );
wo( 'woodFadeMacro', 'multiply', 'woodMacroV', 'wood_c2' ); wo( 'woodFadeSumA', 'add', 'woodFadeGm', 'woodFadeW' );
wo( 'woodFadeSum', 'add', 'woodFadeSumA', 'woodFadeMacro' ); wo( 'woodFade', 'clamp', 'woodFadeSum', 'wood_zero', 'wood_one' );
wo( 'woodTintLuma', 'dot', 'woodTint', 'wood_lumaRGB' ); wo( 'woodBrightPaint', 'smoothstep', 'wood_c45', 'wood_c8', 'woodTintLuma' );
wo( 'woodFadeGMix', 'multiply', 'woodGrimeA', 'wood_c4' ); wo( 'woodFadePaint', 'add', 'wood_c6', 'woodFadeGMix' );
wo( 'woodAgedAmount', 'multiply', 'woodBrightPaint', 'woodFadePaint' ); wo( 'woodAgedTint', 'multiply', 'woodTint', 'wood_woodPaintWarm' );
wo( 'woodAged', 'mix', 'woodTint', 'woodAgedTint', 'woodAgedAmount' );
wo( 'woodChalkBase', 'multiply', 'woodTint', 'wood_c64' ); wo( 'woodChalk', 'add', 'woodChalkBase', 'wood_chalkRGB' );
wo( 'woodFadeHalf', 'multiply', 'woodFade', 'wood_half' ); wo( 'woodPaintTint', 'mix', 'woodAged', 'woodChalk', 'woodFadeHalf' );
wo( 'woodPaintBump', 'subtract', 'woodPB', 'wood_half' ); wo( 'woodPaintBumpScale', 'multiply', 'woodPaintBump', 'wood_c16' );
wo( 'woodPaintBumpFactor', 'add', 'wood_one', 'woodPaintBumpScale' ); wo( 'woodPaintColorRaw', 'multiply', 'woodPaintTint', 'woodPaintBumpFactor' );
wo( 'woodPaintColor', 'mix', 'woodBaseAlbedo', 'woodPaintColorRaw', 'woodPainted' );

// Pattern mask setup is shared by the exact derivative-faded shade and slope
// expressions below.
const woodPatternShade = {};
for ( const [ name, mask, uv, spacing, edge, low, high ] of [
	[ 'Lap', 'woodMLap', 'woodV', 0.2, 0.09, 0.45, 1.03 ],
	[ 'Batten', 'woodMBatten', 'woodU', 0.42, 0.12, 0.7, 1 ],
	[ 'Tongue', 'woodMTongue', 'woodU', 0.14, 0.06, 0.6, 1 ],
	[ 'Louver', 'woodMLouver', 'woodV', 0.07, 0.8, 0.42, 1.05 ],
	[ 'UPlank', 'woodMUPlank', 'woodV', 0.105, 0.07, 0.58, 1 ],
	[ 'Horizontal', 'woodMHorizontal', 'woodV', 0.16, 0.05, 0.5, 1 ],
] ) {
	const id = `woodPat${name}`; wc( `${id}Spacing`, spacing ); wc( `${id}Edge`, edge ); wc( `${id}Low`, low ); wc( `${id}High`, high );
	wo( `${id}Coord`, 'divide', uv, `${id}Spacing` ); wo( `${id}Fraction`, 'fract', `${id}Coord` );
	wo( `${id}EdgeRamp`, 'smoothstep', 'wood_zero', `${id}Edge`, `${id}Fraction` ); wo( `${id}Detail`, 'mix', `${id}Low`, `${id}High`, `${id}EdgeRamp` );
	wo( `${id}Shade`, 'mix', 'wood_one', `${id}Detail`, mask ); woodPatternShade[ name ] = `${id}Shade`;
}

// Full source analytic wood-pattern shade and slope terms. These derivative-
// faded ridges are part of the authored siding and decking appearance.
const woodPatternSlope = {};
const woodExactFade = ( id, low, high, footprint ) => {
	wc( `${id}FadeLow`, low ); wc( `${id}FadeHigh`, high );
	wo( `${id}FadeOut`, 'smoothstep', `${id}FadeLow`, `${id}FadeHigh`, footprint );
	wo( `${id}Fade`, 'subtract', 'wood_one', `${id}FadeOut` );
	return `${id}Fade`;
};
const woodLapFade = woodExactFade( 'woodLapExact', 0.02, 0.07, 'woodFootY' );
wc( 'woodLapRange', 0.09 ); wc( 'woodLapLow', 0.45 ); wc( 'woodLapHigh', 1.03 ); wc( 'woodLapSlopeScale', 0.07 );
wo( 'woodLapRamp', 'smoothstep', 'wood_zero', 'woodLapRange', 'woodPatLapFraction' );
wo( 'woodLapDetail', 'mix', 'woodLapLow', 'woodLapHigh', 'woodLapRamp' );
wo( 'woodLapSlopeBase', 'multiply', 'woodPatLapFraction', 'woodLapSlopeScale' );
wo( 'woodLapDetailShade', 'subtract', 'woodLapDetail', 'woodLapSlopeBase' );
wo( 'woodLapExactShade', 'mix', 'wood_c92', 'woodLapDetailShade', woodLapFade ); woodPatternShade.Lap = 'woodLapExactShade';
wc( 'woodLapFractionEdge', 0.07 ); wc( 'woodLapSyLow', -2.4 ); wc( 'woodLapSyHigh', -0.14 );
wo( 'woodLapSlopeCondition', 'lessThan', 'woodPatLapFraction', 'woodLapFractionEdge' );
wo( 'woodLapSlopeRaw', 'select', 'woodLapSlopeCondition', 'woodLapSyLow', 'woodLapSyHigh' );
wo( 'woodLapSlopeY', 'multiply', 'woodLapSlopeRaw', woodLapFade ); woodPatternSlope.LapY = 'woodLapSlopeY';

const woodBattenFade = woodExactFade( 'woodBattenExact', 0.03, 0.09, 'woodFootX' );
wc( 'woodBattenThreshold', 0.12 ); wc( 'woodBattenEnd', 0.2 ); wc( 'woodBattenNarrow', 0.06 );
wo( 'woodBattenIn', 'step', 'woodPatBattenFraction', 'woodBattenThreshold' );
wo( 'woodBattenOuterRamp', 'smoothstep', 'woodBattenThreshold', 'woodBattenEnd', 'woodPatBattenFraction' );
wo( 'woodBattenOuter', 'subtract', 'wood_one', 'woodBattenOuterRamp' );
wo( 'woodBattenOuterShade', 'mix', 'wood_one', 'wood_c7', 'woodBattenOuter' );
wo( 'woodBattenNarrowMix', 'multiply', 'woodBattenIn', 'woodBattenNarrow' ); wo( 'woodBattenInner', 'add', 'wood_one', 'woodBattenNarrowMix' );
wo( 'woodBattenDetailShade', 'multiply', 'woodBattenOuterShade', 'woodBattenInner' );
wo( 'woodBattenExactShade', 'mix', 'wood_c95', 'woodBattenDetailShade', woodBattenFade ); woodPatternShade.Batten = 'woodBattenExactShade';
wc( 'woodBattenCenter', 0.112 ); wc( 'woodBattenTolerance', 0.012 ); wc( 'woodBattenLeft', 0.015 );
wo( 'woodBattenCenterDelta', 'subtract', 'woodPatBattenFraction', 'woodBattenCenter' ); wo( 'woodBattenCenterAbs', 'abs', 'woodBattenCenterDelta' );
wo( 'woodBattenAtCenter', 'lessThan', 'woodBattenCenterAbs', 'woodBattenTolerance' ); wo( 'woodBattenBefore', 'lessThan', 'woodPatBattenFraction', 'woodBattenLeft' );
wo( 'woodBattenSlopeCenter', 'select', 'woodBattenAtCenter', 'wood_two', 'wood_zero' );
wo( 'woodBattenSlopeRaw', 'select', 'woodBattenBefore', 'wood_cminus2', 'woodBattenSlopeCenter' );
wo( 'woodBattenSlopeX', 'multiply', 'woodBattenSlopeRaw', woodBattenFade ); woodPatternSlope.BattenX = 'woodBattenSlopeX';

const woodTongueFade = woodExactFade( 'woodTongueExact', 0.015, 0.05, 'woodFootX' );
wc( 'woodTongueRange', 0.06 ); wc( 'woodTongueLow', 0.6 );
wo( 'woodTongueRamp', 'smoothstep', 'wood_zero', 'woodTongueRange', 'woodPatTongueFraction' );
wo( 'woodTongueDetail', 'mix', 'woodTongueLow', 'wood_one', 'woodTongueRamp' );
wo( 'woodTongueExactShade', 'mix', 'wood_c96', 'woodTongueDetail', woodTongueFade ); woodPatternShade.Tongue = 'woodTongueExactShade';
wo( 'woodTongueAtEdge', 'lessThan', 'woodPatTongueFraction', 'woodTongueRange' );
wo( 'woodTongueSlopeRaw', 'select', 'woodTongueAtEdge', 'wood_one', 'wood_cminus1' );
wo( 'woodTongueSlopeX', 'multiply', 'woodTongueSlopeRaw', woodTongueFade ); woodPatternSlope.TongueX = 'woodTongueSlopeX';

const woodLouverFade = woodExactFade( 'woodLouverExact', 0.008, 0.03, 'woodFootY' );
wc( 'woodLouverRange', 0.8 ); wc( 'woodLouverLow', 0.42 ); wc( 'woodLouverHigh', 1.05 ); wc( 'woodLouverSlopeEdge', 0.85 );
wo( 'woodLouverRamp', 'smoothstep', 'wood_zero', 'woodLouverRange', 'woodPatLouverFraction' );
wo( 'woodLouverDetail', 'mix', 'woodLouverLow', 'woodLouverHigh', 'woodLouverRamp' );
wo( 'woodLouverExactShade', 'mix', 'wood_c8', 'woodLouverDetail', woodLouverFade ); woodPatternShade.Louver = 'woodLouverExactShade';
wo( 'woodLouverAfter', 'greaterThan', 'woodPatLouverFraction', 'woodLouverSlopeEdge' );
wo( 'woodLouverSlopeRaw', 'select', 'woodLouverAfter', 'wood_c12', 'wood_cminus1' );
wo( 'woodLouverSlopeY', 'multiply', 'woodLouverSlopeRaw', woodLouverFade ); woodPatternSlope.LouverY = 'woodLouverSlopeY';

const woodUPlankFade = woodExactFade( 'woodUPlankExact', 0.012, 0.04, 'woodFootY' );
wc( 'woodUPlankRange', 0.07 ); wc( 'woodUPlankLow', 0.58 );
wo( 'woodUPlankRamp', 'smoothstep', 'wood_zero', 'woodUPlankRange', 'woodPatUPlankFraction' );
wo( 'woodUPlankDetail', 'mix', 'woodUPlankLow', 'wood_one', 'woodUPlankRamp' );
wo( 'woodUPlankExactShade', 'mix', 'wood_c95', 'woodUPlankDetail', woodUPlankFade ); woodPatternShade.UPlank = 'woodUPlankExactShade';
wc( 'woodUPlankSlopeEdge', 0.035 ); wc( 'woodUPlankSlopeOuter', 0.07 );
wo( 'woodUPlankAtInner', 'lessThan', 'woodPatUPlankFraction', 'woodUPlankSlopeOuter' );
wo( 'woodUPlankAtOuter', 'lessThan', 'woodPatUPlankFraction', 'woodUPlankSlopeEdge' );
wo( 'woodUPlankInnerSlope', 'select', 'woodUPlankAtInner', 'wood_one', 'wood_zero' );
wo( 'woodUPlankSlopeRaw', 'select', 'woodUPlankAtOuter', 'wood_cminus1', 'woodUPlankInnerSlope' );
wo( 'woodUPlankSlopeY', 'multiply', 'woodUPlankSlopeRaw', woodUPlankFade ); woodPatternSlope.UPlankY = 'woodUPlankSlopeY';

const woodHorizontalFade = woodExactFade( 'woodHorizontalExact', 0.015, 0.05, 'woodFootY' );
wc( 'woodHorizontalRange', 0.05 ); wc( 'woodHorizontalLow', 0.5 );
wo( 'woodHorizontalRamp', 'smoothstep', 'wood_zero', 'woodHorizontalRange', 'woodPatHorizontalFraction' );
wo( 'woodHorizontalDetail', 'mix', 'woodHorizontalLow', 'wood_one', 'woodHorizontalRamp' );
wo( 'woodHorizontalExactShade', 'mix', 'wood_c95', 'woodHorizontalDetail', woodHorizontalFade ); woodPatternShade.Horizontal = 'woodHorizontalExactShade';

// Nail heads and rust stains in the authored deck-plank pattern.
wo( 'woodNailU0', 'subtract', 'woodU', 'wood_c1' ); wo( 'woodNailU1', 'divide', 'woodNailU0', 'wood_c8' );
wo( 'woodNailU2', 'add', 'woodNailU1', 'wood_half' ); wo( 'woodNailU3', 'fract', 'woodNailU2' );
wo( 'woodNailU4', 'subtract', 'woodNailU3', 'wood_half' ); wo( 'woodNailU', 'multiply', 'woodNailU4', 'wood_c8' );
wo( 'woodNailV1', 'subtract', 'woodV', 'wood_c045' ); wo( 'woodNailV2', 'abs', 'woodNailV1' );
wo( 'woodNailV3', 'subtract', 'woodV', 'wood_c155' ); wo( 'woodNailV4', 'abs', 'woodNailV3' ); wo( 'woodNailV', 'min', 'woodNailV2', 'woodNailV4' );
wo( 'woodNailCoord', 'vec2', 'woodNailU', 'woodNailV' ); wo( 'woodNailDistance', 'length', 'woodNailCoord' );
wo( 'woodNailFade', 'smoothstep', 'wood_c0045', 'wood_c0075', 'woodNailDistance' ); wo( 'woodNailDisk', 'subtract', 'wood_one', 'woodNailFade' );
wo( 'woodNailNearRaw', 'smoothstep', 'wood_c0015', 'wood_c004', 'woodPixelFootprint' ); wo( 'woodNailNear', 'subtract', 'wood_one', 'woodNailNearRaw' );
wo( 'woodNailPattern', 'multiply', 'woodNailDisk', 'woodMNail' ); wo( 'woodNail', 'multiply', 'woodNailPattern', 'woodNailNear' );
wo( 'woodStainU', 'multiply', 'woodNailU', 'wood_c3' ); wo( 'woodStainV', 'multiply', 'woodNailV', 'wood_c14' );
wo( 'woodStainCoord', 'vec2', 'woodStainU', 'woodStainV' ); wo( 'woodStainDistance', 'length', 'woodStainCoord' );
wo( 'woodStainFade', 'smoothstep', 'wood_zero', 'wood_c05', 'woodStainDistance' ); wo( 'woodStainDisk', 'subtract', 'wood_one', 'woodStainFade' );
wo( 'woodStain', 'multiply', 'woodStainDisk', 'woodMNail' );

wo( 'woodShadeLapDelta', 'subtract', woodPatternShade.Lap, 'wood_one' );
wo( 'woodShadeBattenDelta', 'subtract', woodPatternShade.Batten, 'wood_one' );
wo( 'woodShadeTongueDelta', 'subtract', woodPatternShade.Tongue, 'wood_one' );
wo( 'woodShadeLouverDelta', 'subtract', woodPatternShade.Louver, 'wood_one' );
wo( 'woodShadeUPlankDelta', 'subtract', woodPatternShade.UPlank, 'wood_one' );
wo( 'woodShadeHorizontalDelta', 'subtract', woodPatternShade.Horizontal, 'wood_one' );
wo( 'woodShadeLapPart', 'multiply', 'woodMLap', 'woodShadeLapDelta' );
wo( 'woodShadeBattenPart', 'multiply', 'woodMBatten', 'woodShadeBattenDelta' );
wo( 'woodShadeTonguePart', 'multiply', 'woodMTongue', 'woodShadeTongueDelta' );
wo( 'woodShadeLouverPart', 'multiply', 'woodMLouver', 'woodShadeLouverDelta' );
wo( 'woodShadeUPlankPart', 'multiply', 'woodMUPlank', 'woodShadeUPlankDelta' );
wo( 'woodShadeHorizontalPart', 'multiply', 'woodMHorizontal', 'woodShadeHorizontalDelta' );
wo( 'woodShadeSumA', 'add', 'woodShadeLapPart', 'woodShadeBattenPart' ); wo( 'woodShadeSumB', 'add', 'woodShadeTonguePart', 'woodShadeLouverPart' );
wo( 'woodShadeSumC', 'add', 'woodShadeUPlankPart', 'woodShadeHorizontalPart' ); wo( 'woodShadeSumD', 'add', 'woodShadeSumA', 'woodShadeSumB' );
wo( 'woodShadeSumE', 'add', 'woodShadeSumD', 'woodShadeSumC' ); wo( 'woodShade', 'add', 'wood_one', 'woodShadeSumE' );

// Surface color: chips/stains, general dirt and salt, splash-zone splashback,
// pattern shading, baked occlusion, and the deck wear treatment.
wo( 'woodStainScale', 'multiply', 'woodStain', 'wood_cminus04' ); wo( 'woodStainBright', 'add', 'wood_one', 'woodStainScale' );
wo( 'woodStainedBase', 'multiply', 'woodBaseAlbedo', 'woodStainBright' );
wo( 'woodPaintedColor', 'mix', 'woodStainedBase', 'woodPaintColor', 'woodPainted' );
wo( 'woodNailedColor', 'mix', 'woodPaintedColor', 'wood_stainRGB', 'woodNail' );
wo( 'woodDirtWeather', 'mix', 'wood_c22', 'wood_half', 'woodW' );
wo( 'woodGrimeDirt', 'mix', 'woodGm', 'woodGs', 'woodRawK' ); wo( 'woodDirtRawScale', 'mix', 'wood_c75', 'wood_c35', 'woodRawK' );
wo( 'woodDirtR', 'x', 'woodGrimeDirt' ); wo( 'woodDirtG', 'y', 'woodGrimeDirt' );
wo( 'woodDirtAmount', 'multiply', 'woodDirtR', 'woodDirtWeather' ); wo( 'woodDirtScale', 'multiply', 'woodDirtAmount', 'woodDirtRawScale' );
wo( 'woodDirtKeep', 'subtract', 'wood_one', 'woodDirtScale' ); wo( 'woodDirtColor', 'multiply', 'woodNailedColor', 'woodDirtKeep' );
wo( 'woodSaltRaw', 'mix', 'wood_c28', 'wood_c16', 'woodRawK' ); wo( 'woodSaltPaint', 'add', 'woodPainted', 'wood_half' );
wo( 'woodSaltAmountA', 'multiply', 'woodDirtG', 'woodSaltRaw' ); wo( 'woodSaltAmount', 'multiply', 'woodSaltAmountA', 'woodSaltPaint' );
wo( 'woodSaltColor', 'mix', 'woodDirtColor', 'wood_saltRGB', 'woodSaltAmount' );
wo( 'woodPaintGrimeAmount', 'multiply', 'woodGrimeB', 'wood_c3' ); wo( 'woodPaintGrimeKeep', 'subtract', 'wood_one', 'woodPaintGrimeAmount' );
wo( 'woodGrimeColor', 'multiply', 'woodSaltColor', 'woodPaintGrimeKeep' );
wo( 'woodSplashNoise0', 'subtract', 'woodGrimeA', 'wood_half' ); wo( 'woodSplashNoise', 'multiply', 'woodSplashNoise0', 'wood_half' );
wo( 'woodSplashMacro0', 'subtract', 'woodMacroV', 'wood_half' ); wo( 'woodSplashMacro', 'multiply', 'woodSplashMacro0', 'wood_c3' );
wo( 'woodSplashHeightA', 'add', 'wood_c55', 'woodSplashNoise' ); wo( 'woodSplashHeight', 'add', 'woodSplashHeightA', 'woodSplashMacro' );
wo( 'woodSplashRiseOut', 'smoothstep', 'wood_zero', 'woodSplashHeight', 'woodV' ); wo( 'woodSplashRise', 'subtract', 'wood_one', 'woodSplashRiseOut' );
wo( 'woodSplash', 'multiply', 'woodWall', 'woodSplashRise' ); wo( 'woodSplashHalf', 'multiply', 'woodSplash', 'wood_half' );
wo( 'woodSplashKeep', 'subtract', 'wood_one', 'woodSplashHalf' );
wo( 'woodSplashDarkColor', 'multiply', 'woodGrimeColor', 'woodSplashKeep' ); wo( 'woodSplashGreenInput', 'multiply', 'woodGrimeA', 'wood_half' );
wo( 'woodSplashGreenSignal', 'add', 'woodGrimeB', 'woodSplashGreenInput' );
wo( 'woodSplashGreenFade', 'smoothstep', 'wood_c4', 'wood_c7', 'woodSplashGreenSignal' );
wo( 'woodSplashGreenAmountA', 'multiply', 'woodSplash', 'woodSplashGreenFade' ); wo( 'woodSplashGreenAmount', 'multiply', 'woodSplashGreenAmountA', 'wood_c7' );
wo( 'woodSplashGreenColor', 'multiply', 'woodSplashDarkColor', 'wood_splashRGB' );
wo( 'woodSplashColor', 'mix', 'woodSplashDarkColor', 'woodSplashGreenColor', 'woodSplashGreenAmount' );
wo( 'woodAONRaw', 'z', 'woodN' ); wo( 'woodAONormalAO', 'w', 'woodN' ); wo( 'woodPAO', 'w', 'woodP' );
wo( 'woodAOPaintedMix', 'mix', 'wood_one', 'woodAONormalAO', 'wood_c35' ); wo( 'woodAOPainted', 'multiply', 'woodAOPaintedMix', 'woodPAO' );
wo( 'woodAO', 'mix', 'woodAONormalAO', 'woodAOPainted', 'woodPainted' );
wo( 'woodAOScale', 'mix', 'wood_one', 'woodAO', 'wood_half' ); wo( 'woodPatternColor', 'multiply', 'woodSplashColor', 'woodShade' );
wo( 'woodBaseColor', 'multiply', 'woodPatternColor', 'woodAOScale' );

// The graph retains the source walking stripe, board-edge dirt, and dampness.

// Vertex-normal-space weather, rain streaks, and the original tidal belt.
wo( 'woodWpX', 'x', 'woodWorldPosition' ); wo( 'woodWpY', 'y', 'woodWorldPosition' ); wo( 'woodWpZ', 'z', 'woodWorldPosition' );
wo( 'woodRainQZ', 'multiply', 'woodWpZ', 'wood_c7' ); wo( 'woodRainQX', 'add', 'woodWpX', 'woodRainQZ' ); wo( 'woodRainQ', 'vec2', 'woodRainQX', 'woodWpY' );
wo( 'woodRainAXZ', 'add', 'woodWpX', 'woodWpZ' ); wo( 'woodRainAXZScale', 'multiply', 'woodRainAXZ', 'wood_c23' );
wo( 'woodRainASeed', 'multiply', 'woodSeed', 'wood_c5mul' ); wo( 'woodRainAX', 'add', 'woodRainAXZScale', 'woodRainASeed' );
wo( 'woodRainAY', 'multiply', 'woodWpY', 'wood_c12m' ); wo( 'woodRainUvA', 'vec2', 'woodRainAX', 'woodRainAY' ); ws( 'woodRainA', 'emissive', 'woodRainUvA' );
wo( 'woodRainBXZ', 'subtract', 'woodWpX', 'woodWpZ' ); wo( 'woodRainBX', 'multiply', 'woodRainBXZ', 'wood_c51' );
wo( 'woodRainBY0', 'multiply', 'woodWpY', 'wood_c3' ); wo( 'woodRainBY', 'add', 'woodRainBY0', 'wood_c37' );
wo( 'woodRainUvB', 'vec2', 'woodRainBX', 'woodRainBY' ); ws( 'woodRainB', 'emissive', 'woodRainUvB' );
wo( 'woodRainAAlpha', 'w', 'woodRainA' ); wo( 'woodRainBR', 'x', 'woodRainB' );
wo( 'woodRainBWide', 'smoothstep', 'wood_c45', 'wood_c85', 'woodRainBR' ); wo( 'woodRainANarrow', 'smoothstep', 'wood_c6', 'wood_c7', 'woodRainAAlpha' );
wo( 'woodRainAWeighted', 'multiply', 'woodRainANarrow', 'wood_c35' ); wo( 'woodRainSum', 'add', 'woodRainBWide', 'woodRainAWeighted' );
wo( 'woodRainClamp', 'clamp', 'woodRainSum', 'wood_zero', 'wood_one' ); wo( 'woodWorldNormalY', 'y', 'woodWorldNormal' );
wo( 'woodSideFace', 'subtract', 'wood_one', 'woodWorldNormalY' ); wo( 'woodSideAbs', 'abs', 'woodWorldNormalY' ); wo( 'woodSide', 'subtract', 'wood_one', 'woodSideAbs' );
wo( 'woodSideSquared', 'multiply', 'woodSide', 'woodSide' ); wo( 'woodRainSide', 'multiply', 'woodSideSquared', 'woodRainClamp' );
wo( 'woodWeatherMix', 'mix', 'wood_c45', 'wood_c55', 'woodW' ); wo( 'woodRainStrength', 'multiply', 'woodRainSide', 'woodWeatherMix' );
wo( 'woodNoEndForRain', 'subtract', 'wood_one', 'woodEndAny' ); wo( 'woodRain', 'multiply', 'woodRainStrength', 'woodNoEndForRain' );
wo( 'woodRainDark', 'multiply', 'woodRain', 'wood_c24' ); wo( 'woodRainKeep', 'subtract', 'wood_one', 'woodRainDark' );
wo( 'woodRainDarkColor', 'multiply', 'woodSplashColor', 'woodRainKeep' ); wo( 'woodRustThreshold', 'smoothstep', 'wood_c5', 'wood_c6', 'woodRainAAlpha' );
wo( 'woodRustColorMix', 'multiply', 'woodRain', 'woodRustThreshold' ); wo( 'woodRustColorScale', 'multiply', 'woodRustColorMix', 'wood_c6' );
wo( 'woodRustTint', 'multiply', 'woodRainDarkColor', 'wood_rustRGB' ); wo( 'woodRainColor', 'mix', 'woodRainDarkColor', 'woodRustTint', 'woodRustColorScale' );

// Walking wear, plank-edge grit and dampness are UV-authored in the source.
wo( 'woodWalkNegativePaint', 'subtract', 'wood_zero', 'woodPaint' ); wo( 'woodWalkCenter', 'subtract', 'woodWalkNegativePaint', 'wood_one' );
wo( 'woodWalkMacroDelta', 'subtract', 'woodMacroV', 'wood_half' ); wo( 'woodWalkMacroNoise', 'multiply', 'woodWalkMacroDelta', 'wood_half' );
wo( 'woodWalkOffset0', 'subtract', 'woodUSurface', 'woodWalkCenter' ); wo( 'woodWalkOffset', 'add', 'woodWalkOffset0', 'woodWalkMacroNoise' );
wo( 'woodWalkWidth', 'divide', 'woodWalkOffset', 'wood_c6' ); wo( 'woodWalkSquare', 'multiply', 'woodWalkWidth', 'woodWalkWidth' );
wo( 'woodWalkExpArg', 'subtract', 'wood_zero', 'woodWalkSquare' ); wo( 'woodWalkExp', 'exp', 'woodWalkExpArg' );
wo( 'woodUp', 'clamp', 'woodWorldNormalY', 'wood_zero', 'wood_one' ); wo( 'woodWalkUp', 'smoothstep', 'wood_c6', 'wood_c9', 'woodUp' );
wo( 'woodWalkEnabled', 'step', 'woodPaint', 'wood_cminus05' ); wo( 'woodWalkEnabledUp', 'multiply', 'woodWalkEnabled', 'woodWalkUp' );
wo( 'woodWalkPath', 'multiply', 'woodWalkEnabledUp', 'woodWalkExp' ); wo( 'woodWalkK', 'multiply', 'woodWalkPath', 'woodNoEndForRain' );
wo( 'woodWalkHalf', 'multiply', 'woodWalkK', 'wood_c55' );
wo( 'woodWalkTrodden', 'multiply', 'woodRainColor', 'wood_troddenRGB' ); wo( 'woodWalkColor', 'mix', 'woodRainColor', 'woodWalkTrodden', 'woodWalkHalf' );
wo( 'woodBevelOther', 'subtract', 'wood_c18', 'woodV' ); wo( 'woodBevel', 'min', 'woodV', 'woodBevelOther' );
wo( 'woodEdgeDirtFade', 'smoothstep', 'wood_c004', 'wood_c03', 'woodBevel' ); wo( 'woodEdgeDirtNear', 'subtract', 'wood_one', 'woodEdgeDirtFade' );
wo( 'woodEdgeDirtUp', 'multiply', 'woodMNail', 'woodWalkUp' ); wo( 'woodEdgeDirtOpen', 'multiply', 'woodEdgeDirtUp', 'woodEdgeDirtNear' );
wo( 'woodEdgeDirtNoEnd', 'multiply', 'woodEdgeDirtOpen', 'woodNoEndForRain' );
wo( 'woodGsR', 'x', 'woodGs' ); wo( 'woodEdgeDirtGrit', 'multiply', 'woodGsR', 'wood_c15m' ); wo( 'woodEdgeDirtBase', 'add', 'wood_c18', 'woodEdgeDirtGrit' );
wo( 'woodEdgeDirtAmount', 'multiply', 'woodEdgeDirtNoEnd', 'woodEdgeDirtBase' );
wo( 'woodEdgeDirtKeep', 'subtract', 'wood_one', 'woodEdgeDirtAmount' ); wo( 'woodEdgeDirtColor', 'multiply', 'woodWalkColor', 'woodEdgeDirtKeep' );
wo( 'woodDampUp', 'multiply', 'woodWalkUp', 'woodRawK' ); wo( 'woodDampNoEnd', 'multiply', 'woodDampUp', 'woodNoEndForRain' );
wo( 'woodDampMacro', 'smoothstep', 'wood_c45', 'wood_c75', 'woodMacroV' ); wo( 'woodDeckDamp', 'multiply', 'woodDampNoEnd', 'woodDampMacro' );
wo( 'woodDampOpen', 'smoothstep', 'wood_zero', 'wood_c06', 'woodBevel' ); wo( 'woodDampEdge', 'subtract', 'wood_one', 'woodDampOpen' );
wo( 'woodDampDarkAmount', 'multiply', 'woodDeckDamp', 'woodDampEdge' ); wo( 'woodDampDark', 'multiply', 'woodDampDarkAmount', 'wood_c18' );
wo( 'woodDampKeep', 'subtract', 'wood_one', 'woodDampDark' ); wo( 'woodDeckColor', 'multiply', 'woodEdgeDirtColor', 'woodDampKeep' );

// Sparse upward-facing bird droppings, matching the source's seed/position hash.
wo( 'woodBirdQ', 'vec2', 'woodWpX', 'woodWpZ' ); wo( 'woodBirdScale', 'divide', 'wood_one', 'wood_c3' ); wo( 'woodBirdScaled', 'multiply', 'woodBirdQ', 'woodBirdScale' );
wo( 'woodBirdCell', 'floor', 'woodBirdScaled' ); wo( 'woodBirdCellX', 'x', 'woodBirdCell' ); wo( 'woodBirdCellY', 'y', 'woodBirdCell' );
wo( 'woodBirdHashX', 'add', 'woodBirdCellX', 'woodSeed' );
const woodBirdChanceHash = woodHash( 'woodBirdChance', 'woodBirdHashX', 'woodBirdCellY' );
wo( 'woodBirdChance', 'step', 'wood_c93', woodBirdChanceHash );
wo( 'woodBirdFrac', 'fract', 'woodBirdScaled' ); wo( 'woodBirdFracCentered', 'subtract', 'woodBirdFrac', 'wood_half2' );
wo( 'woodBirdHashX2Input', 'add', 'woodBirdCellX', 'wood_c31' );
const woodBirdOffsetHashX = woodHash( 'woodBirdOffX', 'woodBirdHashX2Input', 'woodBirdCellY' );
wo( 'woodBirdHashY2Input', 'add', 'woodBirdCellY', 'wood_c77x' );
const woodBirdOffsetHashY = woodHash( 'woodBirdOffY', 'woodBirdCellX', 'woodBirdHashY2Input' );
wo( 'woodBirdOffset', 'vec2', woodBirdOffsetHashX, woodBirdOffsetHashY ); wo( 'woodBirdOffsetCentered', 'subtract', 'woodBirdOffset', 'wood_half2' );
wo( 'woodBirdOffsetScaled', 'multiply', 'woodBirdOffsetCentered', 'wood_c45' ); wo( 'woodBirdCenter', 'subtract', 'woodBirdFracCentered', 'woodBirdOffsetScaled' );
wo( 'woodBirdCenterX', 'x', 'woodBirdCenter' ); wo( 'woodBirdCenterY', 'y', 'woodBirdCenter' ); wo( 'woodBirdYScaled', 'multiply', 'woodBirdCenterY', 'wood_c135' );
wo( 'woodBirdShape', 'vec2', 'woodBirdCenterX', 'woodBirdYScaled' ); wo( 'woodBirdDistance', 'length', 'woodBirdShape' );
wo( 'woodBirdGrimeNoise', 'subtract', 'woodGrimeA', 'wood_half' ); wo( 'woodBirdGrimeOffset', 'multiply', 'woodBirdGrimeNoise', 'wood_c08' );
wo( 'woodBirdDistanceNoisy', 'add', 'woodBirdDistance', 'woodBirdGrimeOffset' );
wo( 'woodBirdUp', 'smoothstep', 'wood_c75', 'wood_c95', 'woodUp' );
wo( 'woodBirdHeight', 'step', 'wood_c26', 'woodWpY' );
wo( 'woodBirdOuterFade', 'smoothstep', 'wood_c10', 'wood_c15m', 'woodBirdDistanceNoisy' ); wo( 'woodBirdOuter', 'subtract', 'wood_one', 'woodBirdOuterFade' );
wo( 'woodBirdPresenceA', 'multiply', 'woodBirdChance', 'woodBirdUp' ); wo( 'woodBirdPresenceB', 'multiply', 'woodBirdPresenceA', 'woodBirdHeight' );
wo( 'woodBirdK', 'multiply', 'woodBirdPresenceB', 'woodBirdOuter' ); wo( 'woodBirdCoreFade', 'smoothstep', 'wood_c02', 'wood_c07', 'woodBirdDistanceNoisy' );
wo( 'woodBirdCoreKeep', 'subtract', 'wood_one', 'woodBirdCoreFade' ); wo( 'woodBirdCore', 'multiply', 'woodBirdK', 'woodBirdCoreKeep' );
wo( 'woodBirdCoreLight', 'mix', 'wood_dropLowRGB', 'wood_dropHighRGB', 'woodBirdCore' );
wo( 'woodBirdK06', 'multiply', 'woodBirdK', 'wood_c6' ); wo( 'woodBirdColor', 'mix', 'woodDeckColor', 'woodBirdCoreLight', 'woodBirdK06' );
wc( 'wood_half2', [ 0.5, 0.5 ] ); wc( 'woodNearHalf', 0.5 );

// Tide-height weathering uses the same grayscale-authored world map as the
// source material, preserving wetness, algae, barnacles, and roughness shifts.
wo( 'woodTideQZ', 'multiply', 'woodWpZ', 'wood_c7' ); wo( 'woodTideQX', 'add', 'woodWpX', 'woodTideQZ' ); wo( 'woodTideQ', 'vec2', 'woodTideQX', 'woodWpY' );
wo( 'woodTideUV0Scale', 'vec2', 'wood_c6', 'wood_c12' ); wo( 'woodTideUV0', 'multiply', 'woodTideQ', 'woodTideUV0Scale' ); ws( 'woodTideG0', 'emissive', 'woodTideUV0' );
wo( 'woodTideG0A', 'w', 'woodTideG0' ); wo( 'woodTideG0R', 'x', 'woodTideG0' ); wo( 'woodTideG0Bump', 'subtract', 'woodTideG0A', 'wood_half' );
wo( 'woodTideHeightNoise', 'multiply', 'woodTideG0Bump', 'wood_c3' ); wo( 'woodTideHeight', 'add', 'woodWpY', 'woodTideHeightNoise' );
wo( 'woodWetFade', 'smoothstep', 'wood_c3', 'wood_c75', 'woodTideHeight' ); wo( 'woodWet', 'subtract', 'wood_one', 'woodWetFade' );
wo( 'woodDampFade', 'smoothstep', 'wood_c7', 'wood_c15', 'woodTideHeight' ); wo( 'woodDamp', 'subtract', 'wood_one', 'woodDampFade' );
wo( 'woodDampScale', 'multiply', 'woodDamp', 'wood_c4' );
wo( 'woodAlgaeBlend', 'multiply', 'woodTideG0A', 'wood_c6' ); wo( 'woodAlgaeR', 'multiply', 'woodTideG0R', 'wood_c4' );
wo( 'woodAlgaeSignal', 'add', 'woodAlgaeBlend', 'woodAlgaeR' );
wo( 'woodAlgaeDark', 'multiply', 'wood_woodAlgaeDark', 'woodAlgaeSignal' );
wo( 'woodAlgaeColor', 'mix', 'wood_woodAlgaeDark', 'wood_woodAlgaeLight', 'woodAlgaeSignal' );
wo( 'woodTideDampKeep', 'subtract', 'wood_one', 'woodDampScale' ); wo( 'woodTideDampInput', 'multiply', 'woodBirdColor', 'woodTideDampKeep' );
wo( 'woodTideDampColor', 'mix', 'woodTideDampInput', 'woodAlgaeColor', 'woodWet' );
wo( 'woodTideUvScale', 'multiply', 'woodTideQ', 'wood_c31' ); ws( 'woodTideG1', 'emissive', 'woodTideUvScale' );
wo( 'woodTideG1B', 'z', 'woodTideG1' );
wo( 'woodBarnHeightLow', 'smoothstep', 'wood_cminus16', 'wood_cminus035', 'woodTideHeight' );
wo( 'woodBarnHeightHigh', 'smoothstep', 'wood_c25', 'wood_c6', 'woodTideHeight' ); wo( 'woodBarnHeightFade', 'subtract', 'wood_one', 'woodBarnHeightHigh' );
wo( 'woodBarnHeight', 'multiply', 'woodBarnHeightLow', 'woodBarnHeightFade' ); wo( 'woodBarn', 'multiply', 'woodTideG1B', 'woodBarnHeight' );
wo( 'woodBarnTint', 'multiply', 'woodBarn', 'wood_c9' ); wo( 'woodBarnColor', 'mix', 'woodTideDampColor', 'wood_barnRGB', 'woodBarnTint' );

// Convert packed RG texture normals to UV-space slopes, blend raw and painted
// relief, and let the engine's shared graph compiler produce each backend.
const woodSlope = ( prefix, sample ) => {
	wo( `${prefix}XY`, 'xy', sample ); wo( `${prefix}Scaled`, 'multiply', `${prefix}XY`, 'wood_two' );
	wo( `${prefix}Centered`, 'subtract', `${prefix}Scaled`, 'wood_one2' );
	wo( `${prefix}Dot`, 'dot', `${prefix}Centered`, `${prefix}Centered` );
	wo( `${prefix}Remainder`, 'subtract', 'wood_one', `${prefix}Dot` );
	wo( `${prefix}Denom2`, 'max', `${prefix}Remainder`, 'wood_c04' ); wo( `${prefix}Denom`, 'sqrt', `${prefix}Denom2` );
	wo( `${prefix}DenomV`, 'vec2', `${prefix}Denom`, `${prefix}Denom` ); wo( `${prefix}Slope`, 'divide', `${prefix}Centered`, `${prefix}DenomV` );
	return `${prefix}Slope`;
};
wc( 'wood_one2', [ 1, 1 ] ); wc( 'wood_cminus16', -1.6 ); wc( 'wood_cminus035', -0.35 );
wc( 'wood_c15', 1.5 ); wc( 'wood_c24', 0.24 ); wc( 'wood_cminus04', -0.4 );
wc( 'wood_woodAlgaeDark', [ 0.028, 0.042, 0.02 ] ); wc( 'wood_woodAlgaeLight', [ 0.11, 0.105, 0.05 ] );
wc( 'wood_barnRGB', [ 0.52, 0.5, 0.44 ] );
const woodSlopeN = woodSlope( 'woodSlopeN', 'woodN' ); const woodSlopeD = woodSlope( 'woodSlopeD', 'woodD' ); const woodSlopeP = woodSlope( 'woodSlopeP', 'woodP' );
wo( 'woodDetailSlope', 'multiply', woodSlopeD, 'woodNearHalf' ); wo( 'woodSlopeWood', 'add', woodSlopeN, 'woodDetailSlope' );
wo( 'woodSlopePaintN', 'multiply', woodSlopeN, 'wood_c3' ); wo( 'woodSlopePaint', 'add', 'woodSlopePaintN', woodSlopeP );
wo( 'woodSlopeSelected', 'mix', 'woodSlopeWood', 'woodSlopePaint', 'woodPainted' );
wo( 'woodSlopeEdge', 'add', 'woodSlopeSelected', 'woodEdgeSlope' );
wo( 'woodSlopeEndScale', 'mix', 'wood_one', 'wood_c4', 'woodEndAny' ); wo( 'woodSlopeEnd', 'multiply', 'woodSlopeEdge', 'woodSlopeEndScale' );
wo( 'woodWalkSlopeScale', 'multiply', 'woodWalkK', 'wood_c45' ); wo( 'woodWalkSlopeKeep', 'subtract', 'wood_one', 'woodWalkSlopeScale' );
wo( 'woodSlopeWalk', 'multiply', 'woodSlopeEnd', 'woodWalkSlopeKeep' );
wo( 'woodDropSlopeScale', 'multiply', 'woodBirdK', 'wood_c7' ); wo( 'woodDropSlopeKeep', 'subtract', 'wood_one', 'woodDropSlopeScale' );
wo( 'woodSlopeWeather', 'multiply', 'woodSlopeWalk', 'woodDropSlopeKeep' );
wo( 'woodSlopeMeshX', 'x', 'woodSlopeWeather' ); wo( 'woodSlopeMeshY', 'y', 'woodSlopeWeather' );
wo( 'woodSlopeSwap', 'vec2', 'woodSlopeMeshY', 'woodSlopeMeshX' );
wo( 'woodSlopeFinal', 'mix', 'woodSlopeWeather', 'woodSlopeSwap', 'woodIsVertical' );
wo( 'woodPatBattenSlopeX', 'multiply', 'woodMBatten', 'woodBattenSlopeX' ); wo( 'woodPatTongueSlopeX', 'multiply', 'woodMTongue', 'woodTongueSlopeX' );
wo( 'woodPatSlopeX', 'add', 'woodPatBattenSlopeX', 'woodPatTongueSlopeX' );
wo( 'woodPatLapSlopeY', 'multiply', 'woodMLap', 'woodLapSlopeY' ); wo( 'woodPatLouverSlopeY', 'multiply', 'woodMLouver', 'woodLouverSlopeY' );
wo( 'woodPatUPlankSlopeY', 'multiply', 'woodMUPlank', 'woodUPlankSlopeY' ); wo( 'woodPatSlopeYA', 'add', 'woodPatLapSlopeY', 'woodPatLouverSlopeY' );
wo( 'woodPatSlopeY', 'add', 'woodPatSlopeYA', 'woodPatUPlankSlopeY' ); wo( 'woodPatSlope', 'vec2', 'woodPatSlopeX', 'woodPatSlopeY' );
wo( 'woodSlopeAll', 'add', 'woodSlopeFinal', 'woodPatSlope' );
wo( 'woodSurfaceNormal', 'normalFromSlope', 'woodWorldPosition', 'woodWorldNormal', 'woodUV', 'woodSlopeAll' );

// Roughness and AO mirror source response, including nail, walking, rain, and
// bird-dropping adjustments.
wc( 'woodNearHalf', 0.5 ); wo( 'woodW03', 'multiply', 'woodW', 'wood_c03' );
wo( 'woodRawRough', 'z', 'woodN' ); wo( 'woodRawWeatherRough', 'add', 'woodRawRough', 'woodW03' );
wo( 'woodPaintRoughMap', 'z', 'woodP' ); wo( 'woodPaintRough', 'mix', 'wood_c4', 'wood_c7', 'woodPaintRoughMap' );
wo( 'woodPaintRoughFade', 'multiply', 'woodFade', 'wood_c12m' ); wo( 'woodPaintRoughFinal', 'add', 'woodPaintRough', 'woodPaintRoughFade' );
wo( 'woodRoughBase', 'mix', 'woodRawWeatherRough', 'woodPaintRoughFinal', 'woodPainted' );
wo( 'woodRoughGrimeR', 'multiply', 'woodGrimeR', 'wood_c06' ); wo( 'woodRoughGrimeG', 'multiply', 'woodGrimeG', 'wood_c08' );
wo( 'woodRoughGrime', 'add', 'woodRoughGrimeR', 'woodRoughGrimeG' ); wo( 'woodRoughDirty', 'add', 'woodRoughBase', 'woodRoughGrime' );
wo( 'woodRoughNail', 'multiply', 'woodNail', 'wood_c3' ); wo( 'woodRoughNoNail', 'subtract', 'woodRoughDirty', 'woodRoughNail' );
wo( 'woodRoughWalk', 'multiply', 'woodWalkK', 'wood_c10' ); wo( 'woodRoughNoWalk', 'subtract', 'woodRoughNoNail', 'woodRoughWalk' );
wo( 'woodRoughRain', 'multiply', 'woodRain', 'wood_c05' ); wo( 'woodRoughWeathered', 'add', 'woodRoughNoWalk', 'woodRoughRain' );
wo( 'woodRoughDrop', 'multiply', 'woodBirdCore', 'wood_c2' ); wo( 'woodRoughBaseFinal', 'subtract', 'woodRoughWeathered', 'woodRoughDrop' );
wo( 'woodWet09', 'multiply', 'woodWet', 'wood_c9' ); wo( 'woodBarn09', 'multiply', 'woodBarn', 'wood_c9' );
wo( 'woodRoughTideWet', 'mix', 'woodRoughBaseFinal', 'wood_c3', 'woodWet09' );
wo( 'woodRoughTideDamp', 'mix', 'woodRoughTideWet', 'wood_c55', 'woodDampScale' );
wo( 'woodRoughBarn', 'mix', 'woodRoughTideDamp', 'wood_c9', 'woodBarn' ); wo( 'woodRoughClamped', 'clamp', 'woodRoughBarn', 'wood_c03', 'wood_one' );
wo( 'woodTideBarnAmount', 'multiply', 'woodBarn', 'wood_c9' );
wo( 'woodAlbedoBarn', 'mix', 'woodTideDampColor', 'wood_barnRGB', 'woodTideBarnAmount' );

const woodRoots = new Set( [ 'woodAlbedoBarn', 'woodRoughClamped', 'woodAO', 'woodSurfaceNormal', 'wood_zero' ] );
// Reuse equal literals. This is important because the signed graph has a
// strict node cap and constants are otherwise repeated by each material term.
const woodAliases = new Map(), woodLiteralIDs = new Map(), woodDeduplicated = [];
for ( const node of woodNodes ) {
	if ( node.op !== 'constant' ) { woodDeduplicated.push( node ); continue; }
	const key = JSON.stringify( node.value ), existing = woodLiteralIDs.get( key );
	if ( existing ) woodAliases.set( node.id, existing );
	else { woodLiteralIDs.set( key, node.id ); woodDeduplicated.push( node ); }
}
const woodResolve = id => woodAliases.get( id ) || id;
const woodNormalized = woodDeduplicated.map( node => node.op === 'input' || node.op === 'constant' ? node : node.op === 'textureSample'
	? { ...node, uv: woodResolve( node.uv ) }
	: node.op === 'textureSampleLevel' ? { ...node, uv: woodResolve( node.uv ), lod: woodResolve( node.lod ) }
	: { ...node, args: node.args.map( woodResolve ) } );
const woodByID = new Map( woodNormalized.map( node => [ node.id, node ] ) );
const woodReachable = new Set();
const visitWood = id => {
	if ( woodReachable.has( id ) ) return;
	woodReachable.add( id ); const node = woodByID.get( id ); if ( ! node ) throw new Error( `Missing Tidewater wood graph node: ${id}` );
	for ( const dependency of node.op === 'textureSample' ? [ node.uv ] : node.op === 'textureSampleLevel' ? [ node.uv, node.lod ] : node.args || [] ) visitWood( dependency );
};
for ( const id of woodRoots ) visitWood( id );
const woodGraphNodes = woodNormalized.filter( node => woodReachable.has( node.id ) );

export const TIDEWATER_WOOD_MATERIAL_GRAPH = Object.freeze( {
	format: 'elsemesh.material-graph/1',
	nodes: Object.freeze( woodGraphNodes.map( node => Object.freeze( node ) ) ),
	outputs: Object.freeze( { baseColor: 'woodAlbedoBarn', roughness: 'woodRoughClamped', metalness: 'wood_zero', occlusion: 'woodAO', surfaceNormal: 'woodSurfaceNormal' } ),
} );
