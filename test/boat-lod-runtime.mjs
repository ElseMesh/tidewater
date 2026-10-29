import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PerspectiveCamera } from '../../../src/engine/scene/Camera.js';
import { loadWorldPackage, updateWorldPackageLOD, disposeWorldPackage } from '../../../src/network/WorldPackage.js';
import { transformBoundsCenter } from '../../../src/network/WorldStreaming.js';
import { Vector3 } from '../../../src/engine/math/Vector3.js';

const source = JSON.parse( await readFile( new URL( '../world-source.json', import.meta.url ) ) );
const boat = source.objects.find( object => object.id === 'elsemesh-object:moored-lobster-boat' );
assert.ok( boat?.lods?.length === 1, 'the authored moored boat has a packaged distance level' );
const asset = async id => readFile( new URL( `../assets/${id.slice( 'sha256:'.length )}`, import.meta.url ) );
const baseBytes = await asset( boat.assetId );
const lowBytes = await asset( boat.lods[ 0 ].assetId );
const connector = {
	worldId: source.worldId,
	manifest: { objects: [ boat ], portals: [] },
	getAsset: async id => {
		assert.equal( id, boat.lods[ 0 ].assetId );
		return lowBytes;
	},
};
const root = await loadWorldPackage( connector, { assets: new Map( [ [ boat.assetId, baseBytes ] ] ) } );
try {
	const center = transformBoundsCenter( boat, boat.streamingBounds.center, new Vector3() );
	const camera = new PerspectiveCamera( 55, 1, .1, 1000 );
	camera.position.copy( center ).add( new Vector3( 0, 0, 50 ) );
	camera.lookAt( center );
	updateWorldPackageLOD( root, camera, 0, 2000 );
	await root.userData.worldPackage.lodControllers.get( boat.id ).pending.get( 1 );
	updateWorldPackageLOD( root, camera, 0, 2000 );
	assert.equal( root.userData.worldPackage.lodControllers.get( boat.id ).transition?.to, 1, 'the packaged boat selects its distant level using transformed local bounds' );
} finally {
	disposeWorldPackage( root );
}

const authored = structuredClone( source );
authored.objects[ 0 ].lods = [
	{ assetId: `sha256:${'a'.repeat( 64 )}`, maxScreenFraction: .12 },
	{ assetId: `sha256:${'b'.repeat( 64 )}`, maxScreenFraction: .04 },
];
const validation = `import importlib.util,json,sys
spec=importlib.util.spec_from_file_location('actions',sys.argv[1])
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
source=json.load(sys.stdin)
module.validate_source(source)
source['objects'][0]['lods'][1]['maxScreenFraction']=.5
try: module.validate_source(source)
except ValueError: pass
else: raise AssertionError('unordered LOD thresholds accepted')
`;
const repositoryRoot = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '../../..' );
execFileSync( 'python3', [ '-B', '-c', validation, path.join( repositoryRoot, 'tools/blender/world_actions.py' ) ], { input: JSON.stringify( authored ), stdio: [ 'pipe', 'pipe', 'pipe' ] } );
console.log( 'Tidewater Blender authoring accepts valid LOD levels and rejects unordered thresholds' );

console.log( 'Tidewater moored boat runtime LOD: ok' );
