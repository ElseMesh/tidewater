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
