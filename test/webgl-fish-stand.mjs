import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { Colliders } from '../../../src/world/Colliders.js';
import { FISH_STAND_VENDOR, fishStandColliderVolumes } from '../game/FishStandContent.js';
import { WebGLFishStandAdapter } from '../webgl/WebGLFishStandAdapter.js';

const source = JSON.parse( await readFile( new URL( '../world-source.json', import.meta.url ), 'utf8' ) );
const placement = source.experience.behaviors[ 'elsemesh.fishing-game/1' ].fishStand;

globalThis.__assetFile = async url => {
	const file = await readFile( new URL( `../source/models/props/${url.split( '/' ).at( -1 )}`, import.meta.url ) );
	return file.buffer.slice( file.byteOffset, file.byteOffset + file.byteLength );
};

const scene = new THREE.Scene();
const colliders = new Colliders();
assert.throws( () => new WebGLFishStandAdapter( THREE, scene, { terrain: { heightAt: () => 2 }, colliders } ), /placement is required/, 'the renderer has no engine-owned Tidewater default placement' );
const adapter = new WebGLFishStandAdapter( THREE, scene, { terrain: { heightAt: () => 2 }, colliders, placement } );
await adapter.ready;

assert.equal( adapter.group.name, 'FishStand', 'the WebGL adapter preserves the canonical content identity' );
assert.deepEqual( adapter.group.position.toArray(), [ placement.position[ 0 ], 2, placement.position[ 1 ] ], 'the WebGL adapter uses the signed world behavior placement' );
assert( adapter.mesh.geometry.attributes.position && adapter.mesh.geometry.attributes.color && adapter.mesh.geometry.attributes.aLayer, 'the authored stall kit geometry and material layer data reach Three.js' );
assert( adapter.mesh.geometry.groups.length > 1 && Array.isArray( adapter.mesh.material ), 'the WebGL path preserves the authored stall kit material groups' );
assert.equal( colliders.boxes.length, fishStandColliderVolumes( 2, placement ).length, 'collision volumes come from the shared content descriptor' );
assert.throws( () => fishStandColliderVolumes( 2 ), /placement is required/, 'collision geometry requires world-authored placement' );
assert.equal( adapter.vendor.name, FISH_STAND_VENDOR.name, 'vendor identity comes from the shared content descriptor' );
assert( adapter.vendor.inRange( { x: adapter.vendor.position.x, y: adapter.vendor.position.y, z: adapter.vendor.position.z } ), 'the canonical buyer interaction radius is exposed to the WebGL path' );

adapter.dispose();
assert.equal( scene.children.length, 0, 'disposing the adapter removes the stand presentation' );
assert.equal( colliders.boxes.length, 0, 'disposing the adapter removes its collision volumes' );
const hostedPlacement = { position: [ 13, -9 ], yaw: -0.75, interactionRadius: 5 };
const hosted = new WebGLFishStandAdapter( THREE, scene, { terrain: { heightAt: () => 3 }, placement: hostedPlacement } );
await hosted.ready;
assert.deepEqual( hosted.group.position.toArray(), [ 13, 3, -9 ], 'hosted vendor placement comes from world experience data' );
assert.equal( hosted.vendor.radius, 5, 'hosted interaction range comes from world experience data' );
hosted.dispose();
console.log( 'webgl fish stand adapter passed (shared placement, geometry, vendor and colliders)' );
