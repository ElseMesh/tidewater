let instance = 0;

export async function createFishingTestExtension( behaviorData ) {
	const moduleURL = new URL( '../extensions/fishing-game-rules.js', import.meta.url );
	moduleURL.searchParams.set( 'test-instance', String( ++ instance ) );
	const { run } = await import( moduleURL.href );
	const initialized = run( { type: 'initialize', behaviorData } );
	const extension = Object.freeze( {
		has: id => id === 'elsemesh.fishing-game/1',
		ready: async id => {
			if ( id !== 'elsemesh.fishing-game/1' ) throw new Error( `unknown fishing test extension ${id}` );
			return initialized;
		},
		run: async ( id, event ) => {
			if ( id !== 'elsemesh.fishing-game/1' ) throw new Error( `unknown fishing test extension ${id}` );
			return run( event );
		},
	} );
	return extension;
}

export async function createFishingTestRuntime( runtime, behaviorData ) {
	runtime.extensions = await createFishingTestExtension( behaviorData );
	runtime.extensionReady = runtime.extensions.ready( 'elsemesh.fishing-game/1' ).then( () => runtime );
	await runtime.extensionReady;
	return runtime;
}
