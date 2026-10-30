// Renderer-free surface fixture for Tidewater gameplay tests. Production
// WebGLWaterQuery requires a WebGL2 renderer and is covered by the browser
// parity test in the engine repository.
export class SyntheticWaterQuery {

	constructor( terrain, seaLevel = 0 ) {

		this.terrain = terrain;
		this.seaLevel = seaLevel;
		this.surfaceOffsetAt = null;
		this.inputs = new Float32Array( 64 * 4 );
		this.cpu = new Float32Array( 64 * 4 );
		this.resultInputs = new Float32Array( 64 * 4 );
		this.count = 1;
		this.slots = new Map();
		this.cpuValid = false;
		this.version = 0;
		this.resultTime = 0;
		this.latency = 0.016;
		this.time = 0;

	}

	setSurfaceOffsetSampler( sampler ) { this.surfaceOffsetAt = sampler; }
	setPoint( i, x, z ) { this.inputs[ i * 4 ] = x; this.inputs[ i * 4 + 1 ] = z; }
	setCamera( x, z ) { this.setPoint( 0, x, z ); }

	allocate( name, n ) {
		if ( this.slots.has( name ) ) return this.slots.get( name ).start;
		const start = this.count;
		this.slots.set( name, { start, n } );
		this.count += n;
		return start;
	}

	get( i, out = {} ) {
		const k = i * 4;
		out.height = this.cpu[ k ]; out.nx = this.cpu[ k + 1 ]; out.nz = this.cpu[ k + 2 ]; out.floor = this.cpu[ k + 3 ];
		return out;
	}

	_height( x, z ) {
		const t = this.time;
		return this.seaLevel
			+ 0.95 * Math.sin( x * 0.035 + z * 0.025 + t * 0.3 )
			+ 0.55 * Math.sin( - x * 0.07 + z * 0.15 - t * 0.55 )
			+ 0.08 * Math.sin( x * 0.21 - z * 0.16 + t * 0.7 )
			+ 0.03 * Math.sin( x * 0.42 + z * 0.09 + t * 1.3 )
			+ 0.01 * Math.sin( x * 0.72 - z * 0.48 + t * 1.6 )
			+ ( this.surfaceOffsetAt?.( x, z, t ) || 0 );
	}

	update( dt, simulationTime = null ) {
		this.time = Number.isFinite( simulationTime ) ? simulationTime : this.time + Math.max( 0, dt );
		this.resultInputs.set( this.inputs );
		for ( let i = 0; i < this.count; i ++ ) {
			const x = this.inputs[ i * 4 ], z = this.inputs[ i * 4 + 1 ], h = this._height( x, z ), e = 0.35;
			const nx = ( h - this._height( x + e, z ) ) / e, nz = ( h - this._height( x, z + e ) ) / e;
			const n = Math.sqrt( nx * nx + nz * nz + 1 ), k = i * 4;
			this.cpu[ k ] = h; this.cpu[ k + 1 ] = nx / n; this.cpu[ k + 2 ] = nz / n; this.cpu[ k + 3 ] = this.terrain.heightAt( x, z );
		}
		this.cpuValid = true;
		this.version ++;
		this.resultTime = this.time;
	}

}
