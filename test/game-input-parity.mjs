import assert from 'node:assert/strict';
import { Game } from '../game/Game.js';
import { WebGLGameAdapter } from '../webgl/WebGLGameAdapter.js';

const createHUD = () => ( {
	standOpen: false, invOpen: false, catchOpen: false, vendor: null,
	openStand( vendor ) { this.standOpen = true; this.invOpen = false; this.vendor = vendor; },
	closeStand() { this.standOpen = false; },
	toggleInventory( force ) { this.invOpen = force ?? ! this.invOpen; if ( this.invOpen ) this.closeStand(); },
} );
const buyer = { kind: 'buyer', position: { x: 2, z: 3 }, inRange: () => true };
const shop = { kind: 'shop', position: { x: 4, z: 5 }, inRange: () => true };
const webgpuHUD = createHUD(), webglHUD = createHUD();
const webgpuActions = [], webglActions = [];
const game = Object.assign( Object.create( Game.prototype ), {
	app: { player: { mode: 'walk', position: { x: 0, y: 0, z: 0 } } },
	vendors: [ buyer, shop ], hud: webgpuHUD, runtime: { fight: null }, _cardDismissed: false,
	endLanding() { this.hud.catchOpen = false; webgpuActions.push( 'dismiss-catch' ); },
	sellAll() { webgpuActions.push( 'sell' ); },
} );
const adapter = Object.assign( Object.create( WebGLGameAdapter.prototype ), {
	activeVendor: buyer, nearVendor: true, hud: webglHUD, runtime: { fight: null },
	ui: { root: { dataset: {} } },
	_endLanding() { this.hud.catchOpen = false; webglActions.push( 'dismiss-catch' ); },
} );

for ( const code of [ 'KeyE', 'Tab', 'Escape', 'KeyI', 'KeyE' ] ) {
	assert.equal( adapter.handleKey( code ), game.handleKey( code ), `${code} is handled the same way by both renderers` );
	assert.deepEqual( [ webglHUD.standOpen, webglHUD.invOpen, webglHUD.vendor ], [ webgpuHUD.standOpen, webgpuHUD.invOpen, webgpuHUD.vendor ], `${code} leaves matching panels and vendor selection` );
}
assert.equal( webgpuHUD.vendor, buyer, 'the WebGPU path opens the nearby fish buyer' );

webgpuHUD.closeStand();
webglHUD.closeStand();
webgpuHUD.catchOpen = true;
webglHUD.catchOpen = true;
assert.equal( adapter.handleKey( 'KeyE' ), game.handleKey( 'KeyE' ), 'E dismisses a catch card without also interacting with the vendor' );
assert.deepEqual( webglActions, [ 'dismiss-catch' ] );
assert.deepEqual( webgpuActions, [ 'dismiss-catch' ] );
assert.equal( webgpuHUD.standOpen, false );
assert.equal( webglHUD.standOpen, false );

game.fight = { state: 'fighting' };
adapter.runtime = { fight: { state: 'fighting' } };
assert.equal( adapter.handleKey( 'KeyE' ), game.handleKey( 'KeyE' ), 'a fight prevents vendor interaction in both renderers' );
assert.equal( webgpuHUD.standOpen, false );
assert.equal( webglHUD.standOpen, false );

adapter.nearVendor = false;
game.vendors.forEach( vendor => { vendor.inRange = () => false; } );
assert.equal( adapter.handleKey( 'KeyE' ), game.handleKey( 'KeyE' ), 'out-of-range E does not interact in either renderer' );

console.log( 'Tidewater WebGPU/WebGL vendor, inventory, catch-card, and fight key parity passed' );
