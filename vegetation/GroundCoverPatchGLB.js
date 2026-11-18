/** Encode Tidewater's renderer-independent patch streams as an indexed glTF binary. */
export function groundCoverPatchGLB( name, patch ) {
	if ( typeof name !== 'string' || ! name || ! patch || !( patch.positions instanceof Float32Array ) || !( patch.normals instanceof Float32Array ) || !( patch.sides instanceof Float32Array ) || !( patch.slots instanceof Float32Array ) || !( patch.bladeData instanceof Float32Array ) || !( patch.indices instanceof Uint16Array || patch.indices instanceof Uint32Array ) ) throw new Error( 'Invalid Tidewater ground-cover patch streams' );
	const vertexCount = patch.positions.length / 3;
	if ( ! Number.isInteger( vertexCount ) || vertexCount < 1 || patch.normals.length !== vertexCount * 3 || patch.sides.length !== vertexCount * 4 || patch.slots.length !== vertexCount * 4 || patch.bladeData.length !== vertexCount * 4 || patch.indices.length < 3 || patch.indices.length % 3 !== 0 || patch.triangles !== patch.indices.length / 3 || patch.indices.some( index => index >= vertexCount ) ) throw new Error( 'Tidewater ground-cover patch stream lengths or indices do not match' );
	const chunks = [], bufferViews = [], accessors = [];
	let byteLength = 0;
	const add = ( typed, target, type, componentType, bounds = false ) => {
		const padding = ( 4 - byteLength % 4 ) % 4;
		if ( padding ) { chunks.push( new Uint8Array( padding ) ); byteLength += padding; }
		const bytes = new Uint8Array( typed.buffer, typed.byteOffset, typed.byteLength );
		const bufferView = bufferViews.length;
		bufferViews.push( { buffer: 0, byteOffset: byteLength, byteLength: bytes.byteLength, target } );
		chunks.push( bytes ); byteLength += bytes.byteLength;
		const accessor = { bufferView, componentType, count: typed.length / ( type === 'SCALAR' ? 1 : Number( type.slice( 3 ) ) ), type };
		if ( bounds ) {
			accessor.min = [ Infinity, Infinity, Infinity ]; accessor.max = [ - Infinity, - Infinity, - Infinity ];
			for ( let index = 0; index < typed.length; index += 3 ) for ( let axis = 0; axis < 3; axis ++ ) { accessor.min[ axis ] = Math.min( accessor.min[ axis ], typed[ index + axis ] ); accessor.max[ axis ] = Math.max( accessor.max[ axis ], typed[ index + axis ] ); }
		}
		accessors.push( accessor );
		return accessors.length - 1;
	};
	const attributes = {
		POSITION: add( patch.positions, 34962, 'VEC3', 5126, true ),
		NORMAL: add( patch.normals, 34962, 'VEC3', 5126 ),
		_ELSEMESH_VDATA: add( patch.sides, 34962, 'VEC4', 5126 ),
		_ELSEMESH_VDATA1: add( patch.slots, 34962, 'VEC4', 5126 ),
		_ELSEMESH_VDATA2: add( patch.bladeData, 34962, 'VEC4', 5126 ),
	};
	const indexAccessor = add( patch.indices, 34963, 'SCALAR', patch.indices instanceof Uint32Array ? 5125 : 5123 );
	const binary = new Uint8Array( byteLength );
	let offset = 0;
	for ( const chunk of chunks ) { binary.set( chunk, offset ); offset += chunk.byteLength; }
	const gltf = {
		asset: { version: '2.0', generator: 'Tidewater renderer-neutral ground-cover exporter/1' },
		scene: 0, scenes: [ { nodes: [ 0 ] } ], nodes: [ { name } ],
		meshes: [ { name, primitives: [ { attributes, indices: indexAccessor, material: 0, mode: 4 } ] } ],
		materials: [ { name: 'Tidewater ground cover', doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [ 1, 1, 1, 1 ], metallicFactor: 0, roughnessFactor: 0.8 } } ],
		accessors, bufferViews, buffers: [ { byteLength: binary.byteLength } ],
	};
	const json = new TextEncoder().encode( JSON.stringify( gltf ) );
	const jsonLength = ( json.byteLength + 3 ) & ~3, binLength = ( binary.byteLength + 3 ) & ~3;
	const totalLength = 12 + 8 + jsonLength + 8 + binLength;
	const result = new Uint8Array( totalLength ), view = new DataView( result.buffer );
	view.setUint32( 0, 0x46546c67, true ); view.setUint32( 4, 2, true ); view.setUint32( 8, totalLength, true );
	view.setUint32( 12, jsonLength, true ); view.setUint32( 16, 0x4e4f534a, true );
	result.fill( 0x20, 20, 20 + jsonLength ); result.set( json, 20 );
	const binaryHeader = 20 + jsonLength;
	view.setUint32( binaryHeader, binLength, true ); view.setUint32( binaryHeader + 4, 0x004e4942, true );
	result.set( binary, binaryHeader + 8 );
	return result;
}
