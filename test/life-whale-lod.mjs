// Tidewater humpback LOD close-ups at its switch distances.
//   node test/life-whale-lod.mjs [outDir]
import { readFileSync } from 'node:fs';
import { setupLife } from '../../../test/life-harness.mjs';
import * as E from '../../../src/engine/index.js';

const OUT = process.argv[ 2 ] || '/var/tmp';
const ROOT = new URL( '../../../public', import.meta.url ).pathname;
globalThis.fetch = async ( url ) => {

	const buf = readFileSync( ROOT + url );
	return { json: async () => JSON.parse( buf.toString() ), arrayBuffer: async () => buf.buffer.slice( buf.byteOffset, buf.byteOffset + buf.byteLength ) };

};

const L = await setupLife( { W: 2560, H: 1267, ground: { center: [ 35, - 10 ], size: 500, res: 2 }, water: true } );
const { Whale } = await import( '../marine/Whale.js' );
const { TIDEWATER_WHALE_PROFILE } = await import( '../WhaleProfile.js' );
const { createHumpbackBrain } = await import( '../marine/HumpbackBrain.js' );
const whale = new Whale( { scene: L.scene, terrain: L.terrain, profile: TIDEWATER_WHALE_PROFILE, createBrain: createHumpbackBrain } );
await whale.load();
const b = whale.brain;
for ( let t = 0; t < 600; t += 0.1 ) {

	whale.update( 0.1, L.camera );
	if ( t > 20 && b.backDepth < 0.3 ) break;

}

const side = new E.Vector3( Math.cos( b.yaw ), 0, - Math.sin( b.yaw ) );
// just inside / beyond each switch distance (48 m, 170 m; 8% hysteresis)
for ( const [ name, d, fov ] of [ [ 'lod0-47m', 47, 14 ], [ 'lod1-54m', 54, 12 ], [ 'lod1-160m', 160, 5 ], [ 'lod2-190m', 190, 4.2 ] ] ) {

	const cam = L.camera;
	cam.fov = fov;
	whale._lod = d > 100 ? 1 : 0;
	for ( let i = 0; i < 3; i ++ ) {

		L.frame( 1 / 60, ( dt ) => {

			whale.update( dt, cam );
			const p = b.position;
			cam.position.set( p.x + side.x * d, p.y + d * 0.25, p.z + side.z * d );
			cam.lookAt( p );

		} );
		await L.GPU.queue.onSubmittedWorkDone();

	}

	console.log( name, 'lod', whale.lod, 'dist', cam.position.distanceTo( b.position ).toFixed( 1 ) );
	await L.save( OUT + `/whale-${ name }.png` );

}

await L.exit();
