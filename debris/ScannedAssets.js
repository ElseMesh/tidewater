// Tidewater's scanned log, branch and shell catalog. The integer placement IDs
// and measured dimensions are shared by its placement algorithm and renderer.
export const SCAN = Object.freeze( { TRUNK: 0, BRANCH_A: 1, BRANCH_B: 2, SHELL: 3 } );

export const SCANNED_DEBRIS_ASSETS = Object.freeze( [
	Object.freeze( { id: 'dead_quiver_trunk', size: Object.freeze( [ 1.994, 0.306, 0.268 ] ) } ),
	Object.freeze( { id: 'dead_quiver_branch_02', size: Object.freeze( [ 0.526, 0.287, 0.201 ] ) } ),
	Object.freeze( { id: 'dead_quiver_branch_01', size: Object.freeze( [ 0.439, 0.255, 0.227 ] ) } ),
	Object.freeze( { id: 'lambis_shell', size: Object.freeze( [ 0.139, 0.047, 0.075 ] ) } ),
] );

export const SCAN_SIZE = Object.freeze( SCANNED_DEBRIS_ASSETS.map( asset => asset.size ) );

export function scannedAssetRuntimeDescriptors( assetBase ) {
	const base = assetBase.endsWith( '/' ) ? assetBase : `${assetBase}/`;
	return SCANNED_DEBRIS_ASSETS.map( ( { id, size } ) => ( {
		id,
		size,
		geometryURL: `${base}${id}.glb`,
		textureURLs: Object.fromEntries( [ 'albedo', 'normal', 'arm' ].map( map => [ map, `${base}${id}_${map}.jpg` ] ) ),
	} ) );
}
