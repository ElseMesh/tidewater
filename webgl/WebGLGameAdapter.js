import { GameHUD } from '../game/GameHUD.js';
import { createWorldBehaviorRuntime, worldBehaviorData } from '../../../src/network/WorldBehaviorRegistry.js';
import { FishingRod } from '../game/FishingRod.js';
import { fishingHabitatAt } from '../game/Bites.js';
import { WebGLFishingRodPresentation } from './WebGLFishingRodPresentation.js';
import { FishingInputController } from '../FishingInputController.js';
import { Guide } from '../game/Guide.js';
import { canFishInWorld, stepFishingBite, strikeFishing, stepFishingFight } from '../game/FishingGameplay.js';

const CATCH_CARD_MS = 9000;

export function createGameUI( engineRoot = null ) {

	const root = document.createElement( 'div' );
	root.className = engineRoot ? 'em-root em-world-ui' : 'em-root';
	root.dataset.panel = 'closed';
	const hud = document.createElement( 'div' );
	hud.className = 'em-hud';
	const toasts = document.createElement( 'div' );
	toasts.className = 'em-toasts';
	const prompt = document.createElement( 'div' );
	prompt.className = 'em-prompt em-glass';
	const key = document.createElement( 'kbd' );
	key.className = 'em-prompt-key';
	const text = document.createElement( 'span' );
	text.className = 'em-prompt-text';
	prompt.append( key, text );
	hud.append( toasts, prompt );
	root.append( hud );
	( engineRoot || document.body ).append( root );
	const timers = new Set();
	return {
		root, hud, prompt, promptKey: key, promptText: text,
		toast( message, ms = 2500 ) {
			const element = document.createElement( 'div' );
			element.className = 'em-toast em-glass is-in';
			element.setAttribute( 'role', 'status' );
			const label = document.createElement( 'span' );
			label.className = 'em-toast-text';
			label.textContent = String( message );
			element.append( label );
			toasts.append( element );
			const timer = setTimeout( () => { element.remove(); timers.delete( timer ); }, ms );
			timers.add( timer );
		},
		dispose() {
			for ( const timer of timers ) clearTimeout( timer );
			root.remove();
		},
	};

}

// The WebGL path uses the same browser fishing runtime, saved GameState and HUD as WebGPU. It
// presents the shared rod simulation with Three.js while keeping world/input/render work local.
export class WebGLGameAdapter {

	constructor( vendor, { vendors = [ vendor ], experience, worldId = 'elsemesh:local', extensions = null, THREE, scene, camera, query, terrain, boatController = null, boatRoot = null, audio = null, engineRoot = null, engineUI = null } = {} ) {

		this.fishingAreas = worldBehaviorData( experience, 'elsemesh.fishing-game/1' ).fishingAreas;
		this.camera = camera;
		this.boatController = boatController;
		this.app = { player: null, boatCtl: boatController };
		this.engineUI = engineUI;
		this.minimap = null;
		this.runtime = createWorldBehaviorRuntime( experience, 'elsemesh.fishing-game/1', {
			worldId, extensions, controller: boatController, terrain,
			habitatAt: ( x, z, depth ) => this._habitatAtPoint( x, z, depth ),
		} );
		this.state = this.runtime.state;
		this.boatGameplay = this.runtime.boatGameplay;
		this.boatGameplay.onFuelOut = () => this.toast( 'Out of fuel · buy diesel at the chandlery by the boathouse', 4000 );
		this.fishCatalog = this.runtime.fishCatalog;
		this.ui = createGameUI( engineRoot );
		this.vendor = vendor;
		this.audio = audio;
		this.vendors = vendors;
		this.activeVendor = vendor;
		this.hud = new GameHUD( this.ui, this );
		this.nearVendor = false;
		this.landing = null;
		this.rod = camera && query && terrain ? new FishingRod( { camera, query, terrain, audio, render: false } ) : null;
		this.rodPresentation = this.rod && THREE && scene ? new WebGLFishingRodPresentation( THREE, scene, this.rod ) : null;
		this.deckFloodlights = createDeckFloodlights( THREE, boatRoot );
		this.fishingInput = new FishingInputController();
		this.guide = engineUI ? new Guide( engineUI, this ) : null;
		this._onReplayGuide = this.guide ? () => this.guide.replay() : null;
		if ( this._onReplayGuide ) engineUI.onReplayGuide = this._onReplayGuide;
		if ( this.rod ) {
			this.rod.onLand = where => this._onBobberLanded( where );
		}
		this._applyGear();
		this.state.onChange( () => this._applyGear() );

	}

	handleKey( code ) {

		if ( this.hud.catchOpen && ( code === 'KeyE' || code === 'Escape' ) ) {
			this._endLanding();
			return true;
		}

		if ( code === 'KeyE' && this.nearVendor ) {
			if ( this.hud.standOpen ) this.hud.closeStand();
			else this.hud.openStand( this.activeVendor || this.vendor );
			this.ui.root.dataset.panel = this.hud.standOpen ? 'open' : 'closed';
			return true;
		}
		if ( ( code === 'KeyI' || code === 'Tab' ) && ! this.hud.standOpen ) {
			this.hud.toggleInventory();
			this.ui.root.dataset.panel = this.hud.invOpen ? 'open' : 'closed';
			return true;
		}
		if ( code === 'Escape' && ( this.hud.standOpen || this.hud.invOpen ) ) {
			this.hud.closeStand();
			this.hud.toggleInventory( false );
			this.ui.root.dataset.panel = 'closed';
			return true;
		}
		return false;

	}

	get bite() { return this.runtime?.bite || null; }
	get fight() { return this.runtime?.fight || null; }

	vendorPosition( id ) {

		const kind = id === 'joe' ? 'buyer' : id === 'marta' ? 'shop' : null;
		return kind ? this.vendors.find( vendor => vendor.kind === kind )?.position || null : null;

	}

	setMinimap( minimap ) {

		this.minimap = minimap;
		if ( this.guide ) this.guide.minimap = minimap;

	}

	update( dt, player, input = null, { timeOfDay = 12, freeCam = false } = {} ) {

		const position = player?.position || player;
		this.activeVendor = player?.mode === 'walk' ? this.vendors.find( vendor => vendor.inRange( position ) ) || null : null;
		this.nearVendor = !! this.activeVendor;
		if ( this.hud.standOpen && ! this.nearVendor ) {
			this.hud.closeStand();
			this.ui.root.dataset.panel = 'closed';
		}
		this.ui.promptKey.textContent = 'E';
		this.ui.promptText.textContent = this.hud.standOpen ? 'Leave' : `Talk to ${ ( this.activeVendor || this.vendor ).name.split( ' ·' )[ 0 ] }`;
		this.ui.prompt.classList.toggle( 'is-on', this.nearVendor );
		const rod = this.rod;
		const boatGauges = this.boatGameplay?.step( dt, player.mode ) || { fuel: null, sonar: null };
		if ( rod && input ) {
			this.timeOfDay = timeOfDay;
			const canFish = canFishInWorld( { mode: player.mode, freeCam, photoMode: this.engineUI?._photo } );
			const panelOpen = this.hud.standOpen || this.hud.invOpen;
			const { leftDown, leftHeld: left } = this.fishingInput.update( {
				rod, runtime: this.runtime, input, canFish, panelOpen,
				onUnavailable: () => this.runtime.cancel(),
				onRodToggled: equipped => this.toast( equipped ? 'Rod out · hold left mouse to cast' : 'Rod away', 1600 ),
				onStrike: () => this._strike().catch( error => console.error( 'Fishing fight worker failed', error ) ),
			} );
			if ( rod.state === 'floating' ) {
				stepFishingBite( { runtime: this.runtime, rod, dt, habitat: () => this._habitat( rod ), hour: timeOfDay, audio: this.audio, toast: ( ...args ) => this.toast( ...args ) } ).catch( error => console.error( 'Fishing bite worker failed', error ) );
			}
			if ( this.runtime.fight ) this._stepFight( dt, left && ! panelOpen, timeOfDay ).catch( error => console.error( 'Fishing fight worker failed', error ) );
			rod.update( dt, { visible: canFish, fight: this.runtime.fight } );
			this.rodPresentation?.update();
			const landing = this.landing;
			if ( landing && rod.state === 'landing' && canFish ) {
				if ( ! landing.shown && rod.t > 0.3 ) {
					landing.shown = true;
					this.hud.showCatch( landing.card, CATCH_CARD_MS );
				}
				if ( landing.shown ) {
					landing.cardT += dt;
					if ( leftDown || input.hit( 'KeyE' ) || input.hit( 'Escape' ) || landing.cardT > CATCH_CARD_MS / 1000 ) this._endLanding();
				}
			} else if ( landing ) this._endLanding();
			player.busy = rod.lineInWater || rod.state === 'windup';
		}
		this.hud.update( { ...boatGauges, fight: this.runtime?.fight || null, casting: rod?.state === 'windup', power: rod?.power || 0, bite: this.runtime?.bite?.phase === 'take', aiming: rod?.equipped || this.nearVendor && ! this.hud.standOpen } );
		this.minimap?.update( dt, { camera: this.camera, player, boat: this.boatController } );
		if ( this.guide ) {
			this.app.player = player;
			this.app.boatCtl = this.boatController;
			this.guide.update( dt );
		}
		if ( dt < 0 ) throw new Error( 'WebGL game adapter received a negative frame delta' );

	}

	_habitat( rod ) {

		return this._habitatAtPoint( rod.bobber.x, rod.bobber.z, rod.depth );

	}

	_habitatAtPoint( x, z, depth ) {

		return fishingHabitatAt( { x, z, depth, areas: this.fishingAreas } );

	}

	_onBobberLanded( where ) {

		if ( where === 'water' ) return this.runtime.startBite( this._habitat( this.rod ), this.timeOfDay ?? 12 ).catch( error => { console.error( 'Fishing bite worker failed', error ); return null; } );
		this.toast( 'Landed on the sand', 1400 );
		return Promise.resolve( null );

	}

	_endLanding() {

		this.landing = null;
		if ( this.hud.catchOpen ) this.hud.hideCatch();
		if ( this.rod?.state === 'landing' ) this.rod.setState( 'idle' );

	}

	_applyGear() {

		this.rod?.setGear( { castM: this.state.stats.castM, reelSpeed: this.state.stats.reelSpeed } );
		for ( const light of this.deckFloodlights || [] ) light.visible = this.state.stats.deckLights;

	}

	async _strike() {

		return strikeFishing( { runtime: this.runtime, state: this.state, rod: this.rod, toast: ( ...args ) => this.toast( ...args ) } );

	}

	async _stepFight( dt, reeling, timeOfDay ) {

		return stepFishingFight( {
			runtime: this.runtime, rod: this.rod, dt, reeling, hour: timeOfDay, audio: this.audio,
			toast: ( ...args ) => this.toast( ...args ),
			onCaught: result => { this.landing = { species: result.fight.species, kg: result.fight.kg, card: result.catchInfo, cardT: 0, shown: false }; },
		} );

	}

	sellAll() {

		const result = this.state.sell();
		if ( result.count ) {

			this.toast( `Sold ${ result.count } fish for $${ result.total }` );
			this.audio?.coin?.();

		}
		return result;

	}

	sell( ids ) {

		const result = this.state.sell( ids );
		if ( result.count ) this.toast( `Sold for $${ result.total }` );
		return result;

	}

	buy( key ) {

		const result = this.runtime.buyUpgrade( key );
		if ( result ) this.toast( `${ result.name }: ${ result.label }` );
		return result;

	}

	refuel() {

		return this.runtime.refuel();

	}

	toast( message, ms ) {

		this.ui.toast( message, ms );

	}

	dispose() {

		this._endLanding();
		this.guide?.dispose();
		if ( this.engineUI?.onReplayGuide === this._onReplayGuide ) this.engineUI.onReplayGuide = null;
		this.rodPresentation?.dispose();
		for ( const light of this.deckFloodlights || [] ) { light.removeFromParent(); light.target.removeFromParent(); }
		this.ui.dispose();

	}

}

export function createDeckFloodlights( T, boatRoot ) {

	if ( ! T?.SpotLight || ! boatRoot ) return [];
	const lights = [];
	for ( const x of [ - 0.8, 0.8 ] ) {
		const light = new T.SpotLight( 0xffecd0, 3.2, 14, Math.acos( 0.45 ), 0.5, 1 );
		const direction = new T.Vector3( x * 0.25, - 0.75, - 0.62 ).normalize();
		light.position.set( x, 2.25, - 1 );
		light.target.position.set( x + direction.x * 8, 2.25 + direction.y * 8, - 1 + direction.z * 8 );
		light.name = 'BoatDeckFloodlight';
		light.castShadow = false;
		light.visible = false;
		boatRoot.add( light, light.target );
		lights.push( light );
	}
	return lights;

}
