import providerIndex from './world-provider.json' with { type: 'json' };

export const TIDEWATER_WORLD_COMPONENTS = Object.freeze( providerIndex.components );

const componentTypes = new Set( TIDEWATER_WORLD_COMPONENTS.map( ( [ type ] ) => type ) );
const behaviorIDs = new Set( providerIndex.behaviors );

export function supportsWorldManifest( manifest ) {
	return ( manifest?.components || [] ).some( component => componentTypes.has( component.type ) ) ||
		Object.keys( manifest?.experience?.behaviors || {} ).some( id => behaviorIDs.has( id ) );
}

export async function loadWorldProvider() {
	await import( './register-behavior.js' );
}
