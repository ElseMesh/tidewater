import { TIDEWATER_CANOPY_PROFILE } from './CanopyProfile.js';

export const TIDEWATER_CANOPY_NEAR_PBR_BASE_COLOR = Object.freeze( [ 0.38, 0.46, 0.28 ] );
export const TIDEWATER_CANOPY_COVERAGE_CUTOFF = 0.5;

function buildCanopyMaterialGraph() {
	const nodes = [];
	const add = ( id, op, values = {} ) => nodes.push( { id, op, ...values } );
	const constant = ( id, value ) => add( id, 'constant', { value } );
	const input = ( id, name ) => add( id, 'input', { name } );
	const unary = ( id, op, value ) => add( id, op, { args: [ value ] } );
	const binary = ( id, op, left, right ) => add( id, op, { args: [ left, right ] } );

	input( 'uv', 'uv' );
	input( 'vertexMaterial', 'vdata1' );
	unary( 'part', 'x', 'vertexMaterial' );
	input( 'instanceData', 'instanceMaterial0' );
	unary( 'seed', 'w', 'instanceData' );
	constant( 'treeSeedMultiplier', TIDEWATER_CANOPY_PROFILE.species.treeSeedMultiplier );
	binary( 'treeSeedScaled', 'multiply', 'seed', 'treeSeedMultiplier' );
	unary( 'treeSeedFraction', 'fract', 'treeSeedScaled' );
	constant( 'treeSpeciesCount', TIDEWATER_CANOPY_PROFILE.palette.trees.length );
	binary( 'treeSpeciesScaled', 'multiply', 'treeSeedFraction', 'treeSpeciesCount' );
	unary( 'treeSpecies', 'floor', 'treeSpeciesScaled' );
	constant( 'treeParityScale', 0.5 );
	binary( 'treeSpeciesHalf', 'multiply', 'treeSpecies', 'treeParityScale' );
	unary( 'treeSpeciesParity', 'fract', 'treeSpeciesHalf' );
	constant( 'treeWideTileThreshold', 0.25 );
	binary( 'treeUsesWideTile', 'greaterThan', 'treeSpeciesParity', 'treeWideTileThreshold' );
	constant( 'treeTileNarrow', 0 );
	constant( 'treeTileWide', 1 );
	add( 'treeTile', 'select', { args: [ 'treeUsesWideTile', 'treeTileWide', 'treeTileNarrow' ] } );

	constant( 'shrubSeedMultiplier', TIDEWATER_CANOPY_PROFILE.species.shrubSeedMultiplier );
	binary( 'shrubSeedScaled', 'multiply', 'seed', 'shrubSeedMultiplier' );
	unary( 'shrubSeedFraction', 'fract', 'shrubSeedScaled' );
	constant( 'shrubSeaGrapeThreshold', TIDEWATER_CANOPY_PROFILE.species.shrubSeaGrapeThreshold );
	constant( 'shrubCrotonThreshold', TIDEWATER_CANOPY_PROFILE.species.shrubCrotonThreshold );
	binary( 'shrubBeforeCroton', 'lessThan', 'shrubSeedFraction', 'shrubCrotonThreshold' );
	binary( 'shrubAfterSeaGrape', 'greaterEqual', 'shrubSeedFraction', 'shrubSeaGrapeThreshold' );
	binary( 'shrubIsCroton', 'and', 'shrubBeforeCroton', 'shrubAfterSeaGrape' );
	constant( 'shrubTileBase', 2 );
	constant( 'shrubCrotonTile', 3 );
	add( 'shrubTile', 'select', { args: [ 'shrubIsCroton', 'shrubCrotonTile', 'shrubTileBase' ] } );

	constant( 'shrubPartThreshold', 2.5 );
	binary( 'isShrub', 'greaterThan', 'part', 'shrubPartThreshold' );
	add( 'tile', 'select', { args: [ 'isShrub', 'shrubTile', 'treeTile' ] } );
	constant( 'half', 0.5 );
	binary( 'tileHalf', 'multiply', 'tile', 'half' );
	unary( 'tileU', 'fract', 'tileHalf' );
	unary( 'tileRow', 'floor', 'tileHalf' );
	binary( 'tileV', 'multiply', 'tileRow', 'half' );
	unary( 'uvX', 'x', 'uv' );
	unary( 'uvY', 'y', 'uv' );
	binary( 'uvXHalf', 'multiply', 'uvX', 'half' );
	binary( 'uvYHalf', 'multiply', 'uvY', 'half' );
	binary( 'atlasU', 'add', 'uvXHalf', 'tileU' );
	binary( 'atlasV', 'add', 'uvYHalf', 'tileV' );
	add( 'atlasUV', 'vec2', { args: [ 'atlasU', 'atlasV' ] } );
	add( 'leafMask', 'textureSample', { slot: 'leafMask', uv: 'atlasUV' } );
	unary( 'leafCoverage', 'x', 'leafMask' );
	constant( 'coverageCutoff', TIDEWATER_CANOPY_COVERAGE_CUTOFF );
	binary( 'coveredLeaf', 'greaterThan', 'leafCoverage', 'coverageCutoff' );
	constant( 'barkPartEnd', 0.5 );
	constant( 'stemPartStart', 4.5 );
	binary( 'isBarkPart', 'lessThan', 'part', 'barkPartEnd' );
	binary( 'isStemPart', 'greaterThan', 'part', 'stemPartStart' );
	binary( 'isWoodyPart', 'or', 'isBarkPart', 'isStemPart' );
	binary( 'visiblePart', 'or', 'coveredLeaf', 'isWoodyPart' );
	constant( 'transparent', 0 );
	constant( 'opaque', 1 );
	add( 'opacity', 'select', { args: [ 'visiblePart', 'opaque', 'transparent' ] } );
	constant( 'baseColor', TIDEWATER_CANOPY_NEAR_PBR_BASE_COLOR );

	return Object.freeze( {
		format: 'elsemesh.material-graph/1',
		nodes: Object.freeze( nodes.map( node => Object.freeze( node ) ) ),
		outputs: Object.freeze( { baseColor: 'baseColor', opacity: 'opacity' } ),
	} );
}

export const TIDEWATER_CANOPY_MATERIAL_GRAPH = buildCanopyMaterialGraph();
