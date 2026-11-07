import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SPECIES } from '../wildlife/BirdSpecies.js';
import { buildBird } from '../wildlife/BirdShapes.js';
import { createPose, setHead, flapWings, setLegs } from '../wildlife/BirdPose.js';
import { WebGLWildlifeAdapter, deformWebGLBirdVertex } from '../renderers/WebGLWildlifeAdapter.js';

const poses = SPECIES.map( ( _species, index ) => createPose( index, 0.4 ) );
for ( const [ speciesIndex, species ] of SPECIES.entries() ) {
	const shape = buildBird( species ), pose = poses[ speciesIndex ];
	const wingIndex = shape.A.findIndex( ( _v, i ) => i % 4 === 3 && shape.A[ i ] >= 5 && shape.A[ i ] < 7.5 ) / 4;
	for ( const index of [ 0, wingIndex ] ) {
		const expected = [ shape.A[ index * 4 ], shape.A[ index * 4 + 1 ], shape.A[ index * 4 + 2 ] ];
		const actual = deformWebGLBirdVertex( shape, species, pose, index );
		assert( Math.hypot( actual[ 0 ] - expected[ 0 ], actual[ 1 ] - expected[ 1 ], actual[ 2 ] - expected[ 2 ] ) < 1e-6, `neutral ${species.name} poses preserve shared body and wing rest vertices` );
	}
}

const posedVertexGoldens = [
	[ [ 0, 0.022, - 0.125 ], [ - 0.01224, 0.0132268, - 0.1182873 ], [ 0.0255424, 0.0237913, 0.0725567 ], [ 0.0190308, - 0.0330381, - 0.0041262 ] ],
	[ [ 0, 0.021, - 0.12 ], [ - 0.01152, 0.0133729, - 0.1143214 ], [ 0.0216785, 0.0215609, 0.0680617 ], [ 0.0172066, - 0.0308606, - 0.0001179 ] ],
	[ [ 0, 0.058, - 0.31 ], [ - 0.0324, 0.0336512, - 0.3008549 ], [ 0.074417, 0.08034, 0.1811701 ], [ 0.0525143, - 0.0975213, - 0.0305343 ] ],
	[ [ 0, 0.027, - 0.172 ], [ - 0.0144, 0.014921, - 0.1656839 ], [ 0.0377822, 0.0302738, 0.1152073 ], [ 0.0256224, - 0.0544529, - 0.0002657 ] ],
	[ [ 0, 0.014, - 0.066 ], [ - 0.0072, 0.0085842, - 0.0621368 ], [ 0.01403, 0.0147765, 0.0301979 ], [ 0.009345, - 0.0227018, 0.0039265 ] ],
];
for ( const [ speciesIndex, species ] of SPECIES.entries() ) {
	const shape = buildBird( species ), pose = createPose( speciesIndex, 0.4 );
	setHead( pose, 0.32, - 0.17, 0.01, - 0.02, 0.03 );
	flapWings( pose, { elev: 0.2, sweep: - 0.1, twist: 0.04, elbow: 0.16, wrist: 0.12, hand: 0.08 }, 1.1, 0.7, 0.1 );
	setLegs( pose, 0.12, - 0.1, - 0.5, - 0.12, - 0.08, - 0.48 );
	pose.fold = 0.35; pose.tailPitch = 0.23; pose.tailSpread = 0.72;
	for ( const [ sampleIndex, vertexIndex ] of [ 0, 163, 205, 313 ].entries() ) {
		const actual = deformWebGLBirdVertex( shape, species, pose, vertexIndex );
		assert( Math.hypot( ...actual.map( ( value, axis ) => value - posedVertexGoldens[ speciesIndex ][ sampleIndex ][ axis ] ) ) < 1e-6,
			`posed ${species.name} body, tail, wing and leg vertices match the WebGPU-parity CPU reference` );
	}
}

const scene = new THREE.Scene();
const adapter = new WebGLWildlifeAdapter( THREE, scene, { heightAt: () => 0 } );
const runtime = {
	 birds: { agents: poses.map( ( P, index ) => ( { visible: true, kind: index === 3 ? 'frigate' : 'gull', f: { P } } ) ) },
	shorebirds: { drawDistance: 190, birds: [] },
	crabs: { nearBurrows: [ { x: 0, y: 0, z: 0, yaw: 0, seed: 0.3, size: 1 } ], ghosts: [], hermits: [] },
};
adapter.update( runtime, { position: new THREE.Vector3() } );
assert.equal( scene.children.length, 8, 'adapter creates five bird and three shared ghost, hermit, and burrow batches' );
const birdMesh = scene.children.find( child => child.name === 'WebGL laughing gull' );
assert.equal( birdMesh.geometry.attributes.position.count, buildBird( SPECIES[ 0 ] ).count );
assert( birdMesh.geometry.attributes.normal.array.every( Number.isFinite ), 'deformed bird normals remain finite' );
assert.equal( adapter.crabs.meshes[ 2 ].count, 1, 'shared burrow presentation records reach the WebGL batch' );
assert( Math.abs( adapter.crabs.meshes[ 2 ].geometry.attributes.iPosScale.array[ 3 ] - 0.05 ) < 1e-6, 'burrows use the shared distance-scaled record' );
adapter.dispose();
assert.equal( scene.children.length, 0, 'disposing removes the WebGL wildlife meshes' );
console.log( 'webgl wildlife adapter passed (shared bird shapes and pose records)' );
