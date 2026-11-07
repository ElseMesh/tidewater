import { Matrix4 } from '../../../src/engine/index.js';
import { Colliders } from '../../../src/world/Colliders.js';
import { buildPier } from '../../../src/world/Pier.js';
import { Rand } from '../../../src/world/Props.js';
import { Village } from '../../../src/world/Village.js';
import { mulberry32 } from '../../../src/util/Noise.js';
import { TIDEWATER_LAYOUT } from '../layout.js';
import * as fishPresentation from '../FishPresentation.js';

const geometrySink = new Proxy( {
	frame: new Matrix4(),
	fishPresentation,
	fishProps: { add: () => {} },
}, { get: ( target, key ) => key in target ? target[ key ] : () => {} } );

// Build the same authored Tidewater pier collision shape for both renderer traces.
export function tidewaterPierColliders( terrain ) {

	const colliders = new Colliders();
	const rand = new Rand( mulberry32( 90210 ) );
	// Match Village's authored random stream: its house and hut layout consumes
	// values before it calls buildPier, which randomizes pile radii and braces.
	Object.create( Village.prototype )._layout( rand );
	buildPier( {
		B: geometrySink,
		terrain,
		colliders,
		rand,
		lights: [],
		inst: { add: () => {} },
		worldLayout: TIDEWATER_LAYOUT,
	} );
	return colliders;

}
