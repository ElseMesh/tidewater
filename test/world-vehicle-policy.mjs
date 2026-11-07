import assert from 'node:assert/strict';
import { BoatModel } from '../../../src/world/BoatModel.js';
import { worldComponentDescriptor } from '../../../src/network/WorldComponentRegistry.js';
import '../register-components.js';

const model = new BoatModel();
try {
	const vehicle = worldComponentDescriptor( 'elsemesh.downeast-boat/1' );
	assert.equal( vehicle?.vehicle, true, 'Tidewater registers its boat as a vehicle component' );
	assert.equal( vehicle.complexityTriangles, model.triangleCount, 'Tidewater owns a complexity budget matching its bundled boat model' );
} finally {
	model.dispose();
}

console.log( 'ok   bundled boat triangle count matches signed vehicle policy contract' );
