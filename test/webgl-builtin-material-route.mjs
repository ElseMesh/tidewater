import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fallbackPath = new URL( '../../../src/fallback/WebGLFallback.js', import.meta.url );
const source = await readFile( fallbackPath, 'utf8' );
const start = source.indexOf( 'async _loadIsland( progress )' );
const end = source.indexOf( 'async _loadBuiltinBatchComponents()', start );
assert.ok( start >= 0 && end > start, 'the built-in WebGL world loader is present' );

const loadIsland = source.slice( start, end );
assert.match( loadIsland, /loadAsync\( this\.defaultWorldAssets\.villageLOD \)/, 'the built-in path loads the packaged village LOD' );
assert.match( loadIsland, /applyWebGLWorldMaterialGraphs\( T, model\.scene, \{ terrainHeightField: this\.terrain \} \)/, 'the built-in village GLB is translated through the engine-owned WebGL material-graph compiler with its terrain field' );

console.log( 'Built-in WebGL village GLBs use the engine material-graph presenter' );
