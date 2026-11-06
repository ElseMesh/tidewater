import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import '../register-components.js';
import { worldComponentBackendAdapter, worldComponentBackendBatchAdapter } from '../../../src/network/WorldComponentBackendRegistry.js';

const adapter = worldComponentBackendAdapter( 'webgl', 'elsemesh.village-materials/2' );
assert.equal( typeof adapter, 'function', 'Tidewater registers its WebGL village material adapter' );
assert.equal( typeof worldComponentBackendBatchAdapter( 'webgl', 'elsemesh.static-vegetation/1' ), 'function', 'Tidewater registers its WebGL vegetation adapter from its own package' );
assert.equal( await adapter( { fallback: {}, assets: new Map() }, { id: 'village-materials', dataAssetId: 'sha256:missing' } ), false, 'the adapter leaves an unavailable asset uninstalled' );

const source = JSON.parse( await readFile( new URL( '../world-source.json', import.meta.url ) ) );
const authoredComponent = source.components.find( candidate => candidate.type === 'elsemesh.village-materials/2' );
const component = { ...authoredComponent, ...authoredComponent.data };
const assetId = component.data.dataAssetId;
const bytes = new Uint8Array( await readFile( new URL( `../assets/${assetId.slice( 'sha256:'.length )}`, import.meta.url ) ) );
const fallback = { THREE, renderer: { capabilities: { getMaxAnisotropy: () => 1 } } };
const result = await adapter( { fallback, assets: new Map( [ [ assetId, bytes ] ] ) }, component );
assert.equal( result?.installed, true, 'the WebGL adapter awaits and installs the decoded signed material maps' );
assert.equal( result.runtime.sharedMaterials.length, 7 );
result.runtime.dispose();

const fallbackSource = await readFile( new URL( '../../../src/fallback/WebGLFallback.js', import.meta.url ), 'utf8' );
assert.doesNotMatch( fallbackSource, /WebGLVillageMaterials|village-materials\/2|village-materials\/1/, 'the generic WebGL fallback does not name Tidewater village materials' );

console.log( 'Tidewater WebGL village material adapter ownership checks passed' );
