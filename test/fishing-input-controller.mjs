import assert from 'node:assert/strict';
import { FishingInputController } from '../FishingInputController.js';

function trace() {

	const events = [];
	const input = { key: null, mouseDown: false, rightDown: false, enabled: true, hit( code ) { return this.key === code; } };
	const rod = {
		equipped: false,
		state: 'stowed',
		equip( equipped ) { this.equipped = equipped; this.state = equipped ? 'idle' : 'stowed'; },
		startWindup() { events.push( 'windup' ); this.state = 'windup'; },
		release() { events.push( 'cast' ); this.state = 'floating'; },
		retrieve() { events.push( 'retrieve' ); this.state = 'retrieving'; },
	};
	const runtime = { fight: null, cancel() { events.push( 'cancel' ); } };
	const controller = new FishingInputController();
	const frame = ( values = {} ) => {
		Object.assign( input, { key: null, mouseDown: false, rightDown: false }, values );
		return controller.update( {
			rod, runtime, input, canFish: values.canFish ?? true, panelOpen: values.panelOpen ?? false,
			onUnavailable: () => { events.push( 'unavailable' ); runtime.cancel(); },
			onRodToggled: equipped => events.push( equipped ? 'rod-out' : 'rod-away' ),
			onStrike: () => events.push( 'strike' ),
		} );
	};

	frame( { key: 'KeyR' } );
	frame( { mouseDown: true } );
	frame();
	frame( { mouseDown: true } );
	frame();
	frame( { rightDown: true } );
	rod.state = 'flying';
	frame();
	frame( { rightDown: true } );
	frame( { key: 'KeyR', canFish: false } );
	frame( { mouseDown: true, panelOpen: true } );
	assert.equal( rod.state, 'stowed', 'a panel prevents fishing actions from consuming its mouse press' );
	return events;

}

const webgpuActions = trace();
const webglActions = trace();
assert.deepEqual( webglActions, webgpuActions, 'both renderer adapters receive the same normalized fishing actions' );
assert.deepEqual( webgpuActions, [ 'rod-out', 'windup', 'cast', 'strike', 'retrieve', 'cancel', 'retrieve', 'unavailable', 'cancel' ] );

console.log( 'shared fishing input controller parity passed' );
