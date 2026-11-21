import assert from 'node:assert/strict';
import '../register-behavior.js';
import { dispatchWorldBehaviorHooks } from '../../../src/network/WorldBehaviorRegistry.js';
import source from '../world-source.json' with { type: 'json' };

const experience = source.experience;
const dispatch = context => dispatchWorldBehaviorHooks( experience, 'onWorldBlocksPlayerInput', context );

assert.equal( dispatch( { app: { game: { hud: { standOpen: true, invOpen: false } } } } ), true,
	'WebGPU built-in and hosted gameplay stop player movement while the vendor panel is open' );
assert.equal( dispatch( { app: { game: { hud: { standOpen: false, invOpen: true } } } } ), true,
	'WebGPU built-in and hosted gameplay stop player movement while the inventory is open' );
assert.equal( dispatch( { fallback: { gameAdapter: { hud: { standOpen: true, invOpen: false } } } } ), true,
	'WebGL built-in and hosted gameplay use the same world input gate' );
assert.equal( dispatch( { app: { game: { hud: { standOpen: false, invOpen: false } } } } ), false,
	'normal player movement remains enabled when no blocking panel is open' );
assert.equal( dispatchWorldBehaviorHooks( { behaviors: {} }, 'onWorldBlocksPlayerInput', {
	app: { game: { hud: { standOpen: true } } },
} ), false, 'worlds without the fishing behavior do not inherit Tidewater input rules' );

console.log( 'Tidewater world input gate: WebGPU and WebGL share vendor/inventory movement blocking' );
