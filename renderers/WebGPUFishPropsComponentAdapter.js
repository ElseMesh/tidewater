import { FishProps } from '../../../src/world/fish/FishProps.js';
import { decodeWorldComponentAsset } from '../../../src/network/WorldComponentAssetCodecRegistry.js';
import { worldFishPresentationFor } from '../../../src/network/WorldFishPresentation.js';
import { registerWorldComponentBackendAdapter } from '../../../src/network/WorldComponentBackendRegistry.js';

registerWorldComponentBackendAdapter( 'webgpu', 'elsemesh.static-fish-props/1', installFishProps );

function installFishProps( { root, connector }, component ) {

	const presentation = worldFishPresentationFor( connector.manifest.experience );
	const placementBytes = connector.assets.get( component.placementAssetId );
	if ( ! placementBytes ) throw new Error( `Fish-prop component ${component.id} is missing its placement asset` );
	const fishProps = new FishProps( presentation );
	fishProps.items = decodeWorldComponentAsset( 'fish-props-placement/1', placementBytes );
	const mesh = fishProps.build();
	root.add( mesh );
	return { installed: true, runtime: { dispose: () => { root.remove( mesh ); fishProps.dispose(); } } };

}
