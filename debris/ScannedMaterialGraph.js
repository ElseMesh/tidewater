// Renderer-neutral material description for photoscanned beach debris.
// This is graph data only; ElseMesh compiles it for both GPU backends.
const nodes = [];
const input = ( id, name ) => ( nodes.push( { id, op: 'input', name } ), id );
const constant = ( id, value ) => ( nodes.push( { id, op: 'constant', value } ), id );
const op = ( id, operation, ...args ) => ( nodes.push( { id, op: operation, args } ), id );
const sample = ( id, slot, uv ) => ( nodes.push( { id, op: 'textureSample', slot, uv } ), id );
const linear = value => value <= 0.04045 ? value / 12.92 : ( ( value + 0.055 ) / 1.055 ) ** 2.4;

const uv = input( 'uv', 'uv' );
const world = input( 'world', 'worldPosition' );
const instance = input( 'instance', 'instanceMaterial0' );
const albedoSample = sample( 'albedoSample', 'baseColor', uv );
const albedo = op( 'albedo', 'rgb', albedoSample );
const armSample = sample( 'armSample', 'metallicRoughness', uv );
const aoSample = sample( 'aoSample', 'occlusion', uv );
const armRoughness = op( 'armRoughness', 'y', armSample );
const armOcclusion = op( 'armOcclusion', 'x', aoSample );
const assetIndex = op( 'assetIndex', 'x', instance );
const random = op( 'random', 'y', instance );
const groundHeight = op( 'groundHeight', 'z', instance );
const isWood = op( 'isWood', 'lessThan', assetIndex, constant( 'woodAssetLimit', 2.5 ) );
const luminance = op( 'luminance', 'dot', albedo, constant( 'luminanceWeights', [ 0.2126, 0.7152, 0.0722 ] ) );
const greyBase = op( 'greyBase', 'multiply', luminance, constant( 'greyGain', 1.12 ) );
const grey = op( 'grey', 'multiply', constant( 'greyTint', [ 1.04, 1.02, 0.98 ] ), greyBase );
const randomBleach = op( 'randomBleach', 'add', op( 'randomBleachAmount', 'multiply', random, constant( 'randomBleachScale', 0.4 ) ), constant( 'bleachBase', 0.45 ) );
const bleach = op( 'bleach', 'select', isWood, randomBleach, constant( 'noBleach', 0 ) );
const bleached = op( 'bleached', 'mix', albedo, grey, bleach );

const worldHeight = op( 'worldHeight', 'y', world );
const groundDelta = op( 'groundDelta', 'subtract', worldHeight, groundHeight );
const contactRamp = op( 'contactRamp', 'smoothstep', constant( 'contactStart', 0 ), constant( 'contactEnd', 0.1 ), groundDelta );
const contact = op( 'contact', 'subtract', constant( 'oneForContact', 1 ), contactRamp );
const sandyGround = op( 'sandyGround', 'smoothstep', constant( 'sandStart', 0.6 ), constant( 'sandEnd', 1.6 ), groundHeight );
const dustAmount = op( 'dustAmount', 'multiply', op( 'contactSand', 'multiply', contact, sandyGround ), constant( 'dustStrength', 0.45 ) );
const dusted = op( 'dusted', 'mix', bleached, constant( 'sandColor', [ linear( 0.8 ), linear( 0.72 ), linear( 0.58 ) ] ), dustAmount );

const wetRamp = op( 'wetRamp', 'smoothstep', constant( 'wetStart', 0.4 ), constant( 'wetEnd', 1.1 ), worldHeight );
const wet = op( 'wet', 'subtract', constant( 'oneForWet', 1 ), wetRamp );
const wetDarkening = op( 'wetDarkening', 'multiply', wet, constant( 'wetDarkeningStrength', 0.45 ) );
const dryFactor = op( 'dryFactor', 'subtract', constant( 'oneForDryFactor', 1 ), wetDarkening );
const baseColor = op( 'baseColor', 'multiply', dusted, dryFactor );
const baseRoughness = op( 'baseRoughness', 'max', armRoughness, constant( 'minimumRoughness', 0.35 ) );
const wetRoughness = op( 'wetRoughness', 'multiply', wet, constant( 'wetRoughnessStrength', 0.85 ) );
const roughness = op( 'roughness', 'mix', baseRoughness, constant( 'wetRoughnessValue', 0.22 ), wetRoughness );
const aoRamp = op( 'aoRamp', 'smoothstep', constant( 'aoStart', 0 ), constant( 'aoEnd', 0.12 ), groundDelta );
const contactAO = op( 'contactAO', 'subtract', constant( 'oneForAO', 1 ), aoRamp );
const contactAOAmount = op( 'contactAOAmount', 'multiply', contactAO, constant( 'contactAOScale', 0.4 ) );
const aoFactor = op( 'aoFactor', 'subtract', constant( 'oneForAOFactor', 1 ), contactAOAmount );
const occlusion = op( 'occlusion', 'multiply', armOcclusion, aoFactor );
const metalness = constant( 'metalness', 0 );

export const TIDEWATER_SCANNED_DEBRIS_MATERIAL_GRAPH = Object.freeze( {
	format: 'elsemesh.material-graph/1',
	nodes: Object.freeze( nodes ),
	outputs: Object.freeze( { baseColor, roughness, metalness, occlusion } ),
} );
