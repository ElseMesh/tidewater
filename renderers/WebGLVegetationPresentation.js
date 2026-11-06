import { buildPalmFar, buildTreeNear, buildShrubNear, buildYoungPalm, buildFern, buildBanana, buildMonstera, buildElephantEar, buildHeliconia, buildStrelitzia, TREE_LOBES } from './webgpu-vegetation/PlantGeometry.js';

function webglPlantGeometry( T, source ) {

	const geometry = new T.BufferGeometry(), position = source.attributes.position, normal = source.attributes.normal, uv = source.attributes.uv, veg = source.attributes.aVeg, parts = source.attributes.aMat;
	const positions = new Float32Array( position.count * 3 ), normals = new Float32Array( position.count * 3 ), uvs = new Float32Array( position.count * 2 ), vegetation = new Float32Array( position.count * 4 ), materials = new Float32Array( position.count * 4 ), colors = new Float32Array( position.count * 3 );
	const palettes = [ 0x765331, 0x416735, 0x527b3b, 0x4c7936, 0x765331, 0x90714a, 0x40642f, 0x5a753b, 0x53743b, 0xb74727, 0x526b44, 0xc17b38 ];
	for ( let i = 0; i < position.count; i ++ ) {
		const j = i * 3;
		positions[ j ] = position.getX( i ); positions[ j + 1 ] = position.getY( i ); positions[ j + 2 ] = position.getZ( i );
		normals[ j ] = normal.getX( i ); normals[ j + 1 ] = normal.getY( i ); normals[ j + 2 ] = normal.getZ( i );
		uvs[ i * 2 ] = uv.getX( i ); uvs[ i * 2 + 1 ] = uv.getY( i );
		for ( let c = 0; c < 4; c ++ ) { vegetation[ i * 4 + c ] = veg.getComponent( i, c ); materials[ i * 4 + c ] = parts.getComponent( i, c ); }
		const color = new T.Color( palettes[ Math.round( parts.getX( i ) ) ] || 0x527b3b );
		colors[ j ] = color.r; colors[ j + 1 ] = color.g; colors[ j + 2 ] = color.b;
	}
	geometry.setAttribute( 'position', new T.Float32BufferAttribute( positions, 3 ) );
	geometry.setAttribute( 'normal', new T.Float32BufferAttribute( normals, 3 ) );
	geometry.setAttribute( 'uv', new T.Float32BufferAttribute( uvs, 2 ) );
	geometry.setAttribute( 'aVeg', new T.Float32BufferAttribute( vegetation, 4 ) );
	geometry.setAttribute( 'aMat', new T.Float32BufferAttribute( materials, 4 ) );
	geometry.setAttribute( 'color', new T.Float32BufferAttribute( colors, 3 ) );
	geometry.setIndex( new T.Uint32BufferAttribute( source.index.array, 1 ) );
	geometry.computeBoundingSphere();
	return geometry;

}

function webglPlantMaterial( T, anchored = false ) {

	const material = new T.MeshStandardMaterial( { vertexColors: true, side: T.DoubleSide, roughness: 0.92 } );
	if ( anchored ) {
		material.onBeforeCompile = shader => {
			shader.vertexShader = shader.vertexShader.replace( '#include <common>', '#include <common>\nattribute vec4 aVeg;\nattribute vec4 aMat;\nattribute float instanceScale;\nattribute float instanceHeight;' );
			shader.vertexShader = shader.vertexShader.replace( '#include <begin_vertex>', `#include <begin_vertex>
				if ( aMat.x < 0.5 ) {
					transformed.x *= instanceScale;
					transformed.z *= instanceScale;
					transformed.y = aVeg.x * instanceHeight;
				} else {
					transformed *= instanceScale;
					transformed.y += instanceHeight;
				}` );
		};
		material.customProgramCacheKey = () => 'elsemesh-webgl-anchored-vegetation';
	}
	return material;

}

export function createWebGLVegetationGroup( T, records, center = [ 0, 0 ] ) {

	const group = new T.Group(), material = webglPlantMaterial( T ), anchoredMaterial = webglPlantMaterial( T, true );
	const distance = record => Math.hypot( record.x - center[ 0 ], record.z - center[ 1 ] );
	const add = ( kind, build, maxDistance, heightScale, castShadow = false, anchored = false ) => {
		const selected = records[ kind ].filter( record => record.y > 0 && distance( record ) <= maxDistance );
		if ( ! selected.length ) return;
		const source = build(), geometry = webglPlantGeometry( T, source.geometry );
		const mesh = new T.InstancedMesh( geometry, anchored ? anchoredMaterial : material, selected.length ), matrix = new T.Matrix4(), position = new T.Vector3(), rotation = new T.Quaternion(), scale = new T.Vector3();
		if ( anchored ) {
			const instanceScale = new Float32Array( selected.length ), instanceHeight = new Float32Array( selected.length );
			for ( let i = 0; i < selected.length; i ++ ) { instanceScale[ i ] = selected[ i ].s; instanceHeight[ i ] = selected[ i ].H; }
			geometry.setAttribute( 'instanceScale', new T.InstancedBufferAttribute( instanceScale, 1 ) );
			geometry.setAttribute( 'instanceHeight', new T.InstancedBufferAttribute( instanceHeight, 1 ) );
		}
		for ( let i = 0; i < selected.length; i ++ ) {
			const record = selected[ i ], h = heightScale( record );
			position.set( record.x, record.y, record.z );
			rotation.setFromAxisAngle( new T.Vector3( 0, 1, 0 ), record.yaw );
			scale.set( anchored ? 1 : record.s, anchored ? 1 : h * ( record.sy ?? 1 ), anchored ? 1 : record.s );
			matrix.compose( position, rotation, scale ); mesh.setMatrixAt( i, matrix );
		}
		mesh.instanceMatrix.needsUpdate = true;
		mesh.computeBoundingSphere();
		mesh.castShadow = castShadow;
		if ( anchored ) mesh.frustumCulled = false;
		mesh.name = `WebGL ${kind}`;
		group.add( mesh );
	};
	add( 'palms', buildPalmFar, 480, record => record.H, true, true );
	add( 'trees', buildTreeNear, 110, record => record.s, true );
	add( 'shrubs', buildShrubNear, 145, record => record.s );
	add( 'youngPalms', buildYoungPalm, 175, record => record.H, false, true );
	add( 'ferns', buildFern, 125, record => record.H, false, true );
	add( 'bananas', buildBanana, 180, record => record.s, true );
	add( 'monsteras', buildMonstera, 175, record => record.s );
	add( 'elephantEars', buildElephantEar, 175, record => record.s );
	add( 'heliconias', buildHeliconia, 175, record => record.s );
	add( 'strelitzias', buildStrelitzia, 175, record => record.s );
	const distantTrees = records.trees.filter( record => {
		const d = distance( record );
		return record.y > 0 && d > 110 && d < 1400;
	} );
	if ( distantTrees.length ) {
		const trunk = new T.CylinderGeometry( 0.11, 0.2, 1, 5 ); trunk.translate( 0, 0.5, 0 );
		const crownLobe = new T.SphereGeometry( 1, 5, 3 );
		const trunkMesh = new T.InstancedMesh( trunk, new T.MeshStandardMaterial( { color: 0x574431, roughness: 1 } ), distantTrees.length );
		const matrix = new T.Matrix4(), position = new T.Vector3(), rotation = new T.Quaternion(), scale = new T.Vector3();
		for ( let i = 0; i < distantTrees.length; i ++ ) {
			const record = distantTrees[ i ], h = record.H;
			position.set( record.x, record.y, record.z ); rotation.setFromAxisAngle( new T.Vector3( 0, 1, 0 ), record.yaw );
			scale.set( h * 0.035, h * 0.38, h * 0.035 );
			matrix.compose( position, rotation, scale ); trunkMesh.setMatrixAt( i, matrix );
		}
		trunkMesh.instanceMatrix.needsUpdate = true;
		trunkMesh.computeBoundingSphere();
		trunkMesh.name = 'WebGL distant trunks'; group.add( trunkMesh );
		const crownColors = [ 0x416b35, 0x527b3b, 0x365f31, 0x47723a, 0x3b6332, 0x527b3b, 0x416b35, 0x365f31 ];
		for ( let l = 0; l < TREE_LOBES.length; l ++ ) {
			const [ ox, oy, oz, radius ] = TREE_LOBES[ l ];
			const mesh = new T.InstancedMesh( crownLobe, new T.MeshStandardMaterial( { color: crownColors[ l ], roughness: 1 } ), distantTrees.length );
			for ( let i = 0; i < distantTrees.length; i ++ ) {
				const record = distantTrees[ i ], s = record.s, sy = record.sy ?? 1, c = Math.cos( record.yaw ), sn = Math.sin( record.yaw );
				position.set( record.x + ( ox * c - oz * sn ) * s, record.y + oy * s * sy, record.z + ( ox * sn + oz * c ) * s );
				rotation.setFromAxisAngle( new T.Vector3( 0, 1, 0 ), record.yaw );
				scale.set( radius * s, radius * s * sy, radius * s );
				matrix.compose( position, rotation, scale ); mesh.setMatrixAt( i, matrix );
			}
			mesh.instanceMatrix.needsUpdate = true;
			mesh.computeBoundingSphere();
			mesh.name = 'WebGL distant canopy lobe'; group.add( mesh );
		}
	}
	return group;

}
