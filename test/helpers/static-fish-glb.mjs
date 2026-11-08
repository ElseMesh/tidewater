export function staticFishGLB( { materialExtras } = {} ) {
	const chunks = [], views = [], accessors = [];
	let byteLength = 0;
	const add = ( values, size, type, target, componentType = 5126 ) => {
		const padding = ( 4 - byteLength % 4 ) % 4;
		if ( padding ) { chunks.push( Buffer.alloc( padding ) ); byteLength += padding; }
		const data = Buffer.from( ( componentType === 5125 ? Uint32Array.from( values ) : Float32Array.from( values ) ).buffer );
		const view = views.length;
		views.push( { buffer: 0, byteOffset: byteLength, byteLength: data.byteLength, target } );
		chunks.push( data ); byteLength += data.byteLength;
		const accessor = { bufferView: view, componentType, count: values.length / size, type };
		if ( type === 'VEC3' && target === 34962 && size === 3 ) { accessor.min = [ - 0.5, 0, 0 ]; accessor.max = [ 0.5, 1, 0 ]; }
		accessors.push( accessor );
		return accessors.length - 1;
	};
	const position = add( [ - 0.5, 0, 0, 0.5, 0, 0, 0, 1, 0 ], 3, 'VEC3', 34962 );
	const normal = add( [ 0, 0, 1, 0, 0, 1, 0, 0, 1 ], 3, 'VEC3', 34962 );
	const vdata = add( [ 0.5, 0, 0.2, 0.1, 0.5, 0, 0.2, 0.1, 0.5, 0, 0.2, 0.1 ], 4, 'VEC4', 34962 );
	const indices = add( [ 0, 1, 2 ], 1, 'SCALAR', 34963, 5125 );
	const binary = Buffer.concat( chunks );
	const gltf = {
		asset: { version: '2.0', generator: 'Tidewater static fish material fixture/1' },
		scene: 0, scenes: [ { nodes: [ 0 ] } ], nodes: [ { mesh: 0 } ],
		meshes: [ { primitives: [ { attributes: { POSITION: position, NORMAL: normal, _ELSEMESH_VDATA: vdata }, indices, material: 0, mode: 4 } ] } ],
		materials: [ { extras: materialExtras, pbrMetallicRoughness: { baseColorFactor: [ 1, 1, 1, 1 ], metallicFactor: 0, roughnessFactor: 0.8 }, doubleSided: true } ],
		accessors, bufferViews: views, buffers: [ { byteLength: binary.byteLength } ],
	};
	const json = Buffer.from( JSON.stringify( gltf ) );
	const jsonPadded = Buffer.concat( [ json, Buffer.alloc( ( 4 - json.length % 4 ) % 4, 0x20 ) ] );
	const binaryPadded = Buffer.concat( [ binary, Buffer.alloc( ( 4 - binary.length % 4 ) % 4 ) ] );
	const total = 12 + 8 + jsonPadded.length + 8 + binaryPadded.length;
	const header = Buffer.alloc( 12 );
	header.writeUInt32LE( 0x46546c67, 0 ); header.writeUInt32LE( 2, 4 ); header.writeUInt32LE( total, 8 );
	const jsonHeader = Buffer.alloc( 8 ); jsonHeader.writeUInt32LE( jsonPadded.length, 0 ); jsonHeader.writeUInt32LE( 0x4e4f534a, 4 );
	const binHeader = Buffer.alloc( 8 ); binHeader.writeUInt32LE( binaryPadded.length, 0 ); binHeader.writeUInt32LE( 0x004e4942, 4 );
	return Buffer.concat( [ header, jsonHeader, jsonPadded, binHeader, binaryPadded ] );
}
