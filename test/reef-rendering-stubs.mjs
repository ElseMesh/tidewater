// Node module hook for reef-rendering.mjs: replaces the Tidewater FishSchools module with a stub when
// REEF_STUB_FISH=1 (the fish are ported / tested separately in worlds/tidewater/test/fish-rendering.mjs).
export async function resolve( specifier, context, next ) {

	if ( process.env.REEF_STUB_FISH === '1' && /\/FishSchools\.js$/.test( specifier ) && context.parentURL && context.parentURL.endsWith( '/tidewater/Reef.js' ) ) {

		const src = `export class FishSchools { constructor() { this.mesh = { visible: false }; this.batch = { visibleInstances: 0 }; this.fishCount = 0; } update() {} cull() {} dispose() {} }`;
		return { url: 'data:text/javascript,' + encodeURIComponent( src ), shortCircuit: true };

	}

	return next( specifier, context );

}
