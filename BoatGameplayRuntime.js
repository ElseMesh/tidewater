// Browser adapter for Tidewater boat rules. Simulation runs in the signed
// Tidewater Worker; this class samples local world data and applies results.
export class BoatGameplayRuntime {

	constructor( { state, controller = null, terrain = null, habitatAt = () => ( {} ), runExtension = null, onFuelOut = null, onError = error => console.error( 'Tidewater boat Worker failed', error ) } = {} ) {

		if ( ! state ) throw new Error( 'Boat gameplay requires game state' );
		this.state = state;
		this.terrain = terrain;
		this.habitatAt = habitatAt;
		this.runExtension = runExtension;
		this.onFuelOut = onFuelOut;
		this.onError = onError;
		this._sonar = null;
		this._configuration = null;
		this._configuredController = null;
		this._fuelRevision = 0;
		this._configReady = Promise.resolve();
		this._steps = [];
		this._stepRunning = false;
		this._idleWaiters = [];
		this._lastStep = null;
		this.setController( controller );

	}

	setController( controller ) {

		this.controller = controller;
		this._base = controller ? { maxThrust: controller.maxThrust, pitchSpeed: controller.pitchSpeed } : null;
		return this.applyGear();

	}

	setTerrain( terrain ) { this.terrain = terrain; }

	applyGear() {

		if ( ! this.runExtension || ! this.controller || ! this._base ) return Promise.resolve( null );
		const stats = this.state.stats;
		const configuration = {
			maxThrust: this._base.maxThrust,
			pitchSpeed: this._base.pitchSpeed,
			speedMul: stats.speedMul,
			fuelTank: stats.fuelL,
			finder: stats.finder,
		};
		if ( this._configuredController === this.controller && this._configuration && Object.keys( configuration ).every( key => configuration[ key ] === this._configuration[ key ] ) ) return this._configReady;
		const fuelTankChanged = this._configuration && configuration.fuelTank !== this._configuration.fuelTank;
		const event = { type: 'configure-boat', ...configuration };
		if ( ! this._configuration || fuelTankChanged ) event.fuelL = this.state.fuelL;
		if ( fuelTankChanged ) this._fuelRevision ++;
		this._configuration = configuration;
		const requestedController = this.controller;
		this._configReady = Promise.resolve( this.runExtension( event ) ).then( result => {
			if ( this.controller === requestedController && result ) {
				this.controller.maxThrust = result.maxThrust;
				this.controller.pitchSpeed = result.pitchSpeed;
				this._configuredController = requestedController;
			}
			return result;
		} );
		this._configReady.catch( this.onError );
		return this._configReady;

	}

	refueled() {

		if ( ! this.runExtension ) return Promise.resolve( null );
		this._fuelRevision ++;
		return Promise.resolve( this.runExtension( { type: 'refuel-boat', fuelL: this.state.fuelL } ) ).catch( error => { this.onError( error ); return null; } );

	}

	step( dt, playerMode = 'walk' ) {

		const boat = this.controller, state = this.state;
		const aboard = playerMode === 'boat' || playerMode === 'deck';
		const gauges = {
			fuel: aboard ? { litres: state.fuelL, tank: state.stats.fuelL } : null,
			sonar: aboard && state.stats.finder ? this._sonar : null,
		};
		if ( ! boat || ! this.runExtension ) return gauges;

		let sonarSample = null;
		if ( aboard && state.stats.finder && this.terrain ) {
			const { x, z } = boat.position;
			const height = this.terrain.heightAt( x, z );
			const depth = Math.max( 0, - height );
			sonarSample = { height, habitat: this.habitatAt( x, z, depth ) };
		}
		const request = this.stepQueued( {
			dt,
			mode: playerMode,
			driven: !! boat.driven,
			rpm: Number.isFinite( boat.rpm ) ? boat.rpm : 0,
			sonarSample,
		} );
		request.catch( this.onError );
		return gauges;

	}

	stepQueued( step ) {

		if ( ! this.runExtension ) return Promise.reject( new Error( 'Tidewater boat gameplay requires its signed JavaScript extension' ) );
		if ( this._steps.length >= 64 ) return Promise.reject( new Error( 'Tidewater boat Worker is behind by more than 64 frames' ) );
		return new Promise( ( resolve, reject ) => {
			this._steps.push( { step, fuelRevision: this._fuelRevision, resolve, reject } );
			queueMicrotask( () => this._pumpSteps() );
		} );

	}

	async _pumpSteps() {

		if ( this._stepRunning || ! this._steps.length ) return;
		this._stepRunning = true;
		const batch = this._steps.splice( 0, 1 );
		try {
			await this._configReady;
			const response = await this.runExtension( { type: 'step-boat', steps: batch.map( request => request.step ) } );
			if ( ! Array.isArray( response?.results ) || response.results.length !== batch.length ) throw new Error( 'Invalid Tidewater boat Worker response' );
			for ( let index = 0; index < batch.length; index ++ ) {
				const result = response.results[ index ];
				if ( ! result || ! Number.isFinite( result.fuelL ) || ! Number.isFinite( result.fuelBurned ) ) throw new Error( 'Invalid Tidewater boat Worker step result' );
				const request = batch[ index ];
				if ( request.fuelRevision === this._fuelRevision ) {
					this.state.fuel = result.fuelL;
					if ( result.saveFuel ) this.state.save();
				}
				if ( result.fuelOut ) this.onFuelOut?.();
				if ( result.throttle !== null && this.controller ) this.controller.throttle = result.throttle;
				if ( result.sonar ) this._sonar = result.sonar;
				this._lastStep = result;
				request.resolve( result );
			}
		} catch ( error ) {
			for ( const request of batch ) request.reject( error );
			this.onError( error );
		} finally {
			this._stepRunning = false;
			if ( this._steps.length ) this._pumpSteps();
			else for ( const resolve of this._idleWaiters.splice( 0 ) ) resolve( this._lastStep );
		}

	}

	whenIdle() {

		if ( ! this._stepRunning && ! this._steps.length ) return Promise.resolve( this._lastStep );
		return new Promise( resolve => this._idleWaiters.push( resolve ) );

	}

}
