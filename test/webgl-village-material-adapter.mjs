import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import '../register-components.js';
import { worldComponentBackendAdapter, worldComponentBackendBatchAdapter } from '../../../src/network/WorldComponentBackendRegistry.js';

const adapter = worldComponentBackendAdapter( 'webgl', 'elsemesh.village-materials/2' );
assert.equal( typeof adapter, 'function', 'Tidewater registers its WebGL village material adapter' );
assert.equal( typeof worldComponentBackendBatchAdapter( 'webgl', 'elsemesh.static-vegetation/1' ), 'function', 'Tidewater registers its WebGL vegetation adapter from its own package' );
assert.equal( adapter( { fallback: {}, assets: new Map() }, { id: 'village-materials', dataAssetId: 'sha256:missing' } ), false, 'the adapter leaves an unavailable asset uninstalled' );

const fallbackSource = await readFile( new URL( '../../../src/fallback/WebGLFallback.js', import.meta.url ), 'utf8' );
assert.doesNotMatch( fallbackSource, /WebGLVillageMaterials|village-materials\/2|village-materials\/1/, 'the generic WebGL fallback does not name Tidewater village materials' );

console.log( 'Tidewater WebGL village material adapter ownership checks passed' );
