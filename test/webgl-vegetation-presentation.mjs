import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWebGLVegetationGroup } from '../renderers/WebGLVegetationPresentation.js';

const records = Object.fromEntries( [ 'palms', 'trees', 'shrubs', 'youngPalms', 'ferns', 'bananas', 'monsteras', 'elephantEars', 'heliconias', 'strelitzias' ].map( kind => [ kind, [] ] ) );
records.trees.push( { x: 0, y: 0.1, z: 0, s: 1, sy: 1, yaw: 0, la: 0, l: 0, H: 12, seed: 0.5 } );

const group = createWebGLVegetationGroup( THREE, records, [ 0, 0 ] );
const tree = group.children.find( child => child.name === 'WebGL trees' );

assert.ok( tree?.isInstancedMesh, 'Tidewater tree records create an instanced WebGL presentation' );
assert.equal( tree.count, 1 );
assert.ok( tree.geometry.getAttribute( 'aVeg' ) && tree.geometry.getAttribute( 'aMat' ), 'Tidewater leaf and material fields reach the WebGL geometry' );
assert.equal( tree.material.vertexColors, true );
console.log( 'Tidewater WebGL vegetation presentation builds instanced species geometry' );

