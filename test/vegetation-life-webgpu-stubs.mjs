// Node module hook for the Tidewater WebGPU vegetation fixture: replaces GrassField.js with a
// stub when VEG_STUB_GRASS=1 (grass is exercised separately by vegetation-life-grass.mjs).
export async function resolve( specifier, context, next ) {

	if ( process.env.VEG_STUB_GRASS === '1' && /\/GrassField\.js$/.test( specifier ) ) {

		const src = `export class GrassField { constructor() { this.meshes = []; this.patchTris = [ 0, 0, 0 ]; this.levels = [ { count: 0 }, { count: 0 }, { count: 0 } ]; this.triangles = 0; this.heightTex = {}; } update() {} dispose() {} }`;
		return { url: 'data:text/javascript,' + encodeURIComponent( src ), shortCircuit: true };

	}

	return next( specifier, context );

}
