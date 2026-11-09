import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import '../register-behavior.js';
import { TerrainData } from '../terrain/TerrainData.js';
import { TIDEWATER_LAYOUT } from '../layout.js';
import { createVegetationPlacement } from '../vegetation/Scatter.js';
import { buildPalmNear, PART } from '../renderers/webgpu-vegetation/PlantGeometry.js';
import { Village } from '../Village.js';
import { Colliders } from '../../../src/world/Colliders.js';
import { Builder } from '../village/GeoBuilder.js';
import { InstancedProps } from '../Props.js';
import { DebrisPlacer } from '../DebrisPlacement.js';
import * as fishPresentation from '../FishPresentation.js';

const terrain = new TerrainData( { worldLayout: TIDEWATER_LAYOUT } );
const colliders = new Colliders();
class PackageVillage extends Village {
 _assemble() { this.meshes = []; }
 _buildSign() {}
 _buildLanterns() {}
}
const village = new PackageVillage( { scene: { add() {}, remove() {} }, terrain, colliders, worldLayout: TIDEWATER_LAYOUT, fishPresentation } );
const vegetation = createVegetationPlacement( terrain, village, TIDEWATER_LAYOUT );
const builder = new Builder();
const debris = new DebrisPlacer( { B: builder, inst: new InstancedProps( builder ), terrain, village, vegetation, colliders, worldLayout: TIDEWATER_LAYOUT } ).run();

const palm = buildPalmNear( 11 ).geometry;
const palmMaterialParts = palm.attributes.aMat;
let crownCoconutVertices = 0;
for ( let vertex = 0; vertex < palmMaterialParts.count; vertex ++ ) if ( palmMaterialParts.getX( vertex ) === PART.COCONUT ) crownCoconutVertices ++;
assert.ok( crownCoconutVertices > 0, 'the Tidewater palm model retains its crown coconuts' );
assert.equal( vegetation.records.palms.length, 233, 'world-owned palm placements remain stable' );
assert.deepEqual( {
 coconut: debris.counts.coconut,
 husk: debris.counts.husk,
 frond: debris.counts.frond,
}, { coconut: 133, husk: 43, frond: 56 }, 'ground and shoreline coconuts and husks, plus fallen fronds, remain present' );

const placements = debris.log.filter( ( [ kind ] ) => [ 'coconut', 'husk', 'frond' ].includes( kind ) );
assert.equal( placements.length, 232, 'the placement audit includes every coconut, husk, and fallen frond' );
assert.equal( createHash( 'sha256' ).update( JSON.stringify( placements ) ).digest( 'hex' ), '81835ec1fc8220ceb53073f5c502a2e27012c71c8a05c704c2330658d1f31f02', 'Tidewater ground coconut, husk, and frond placements remain byte-for-byte deterministic' );

console.log( `Tidewater coconut preservation passed (${ crownCoconutVertices } crown vertices, ${ debris.counts.coconut } coconuts, ${ debris.counts.husk } husks, ${ debris.counts.frond } fallen fronds)` );
