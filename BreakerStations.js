// Tidewater-authored sampling for the main beach breaker band. This produces
// renderer-neutral position and sea-direction records; ElseMesh presenters
// consume the packaged records without choosing shoreline locations themselves.
export function buildTidewaterBreakerStations( terrain, { x0 = - 175, x1 = 195, spacing = 0.6 } = {} ) {
	if ( ! terrain || typeof terrain.heightAt !== 'function' || ! Number.isFinite( x0 ) || ! Number.isFinite( x1 ) || x1 <= x0 || ! Number.isFinite( spacing ) || spacing <= 0 ) {
		throw new TypeError( 'Tidewater breaker stations require a terrain height query and a positive shoreline interval' );
	}
	const points = [];
	for ( let x = x0; x <= x1; x += 0.5 ) {
		if ( terrain.heightAt( x, 12 ) > - 0.3 ) continue;
		let z = 12, shorelineZ = null;
		for ( ; z > - 110; z -= 0.5 ) {
			if ( terrain.heightAt( x, z ) > 0 ) {
				let land = z, water = z + 0.5;
				for ( let iteration = 0; iteration < 16; iteration ++ ) {
					const middle = ( land + water ) * 0.5;
					if ( terrain.heightAt( x, middle ) > 0 ) land = middle;
					else water = middle;
				}
				shorelineZ = ( land + water ) * 0.5;
				break;
			}
		}
		if ( shorelineZ !== null ) points.push( [ x, shorelineZ ] );
	}

	let longest = [], run = [];
	for ( const point of points ) {
		const previous = run.at( - 1 );
		if ( previous && ( Math.abs( point[ 1 ] - previous[ 1 ] ) > 3 || point[ 0 ] - previous[ 0 ] > 1.01 ) ) {
			if ( run.length > longest.length ) longest = run;
			run = [];
		}
		run.push( point );
	}
	if ( run.length > longest.length ) longest = run;

	let smoothed = longest.map( point => [ ...point ] );
	for ( let iteration = 0; iteration < 30; iteration ++ ) {
		smoothed = smoothed.map( ( point, index ) => index === 0 || index === smoothed.length - 1
			? point
			: [ point[ 0 ], ( smoothed[ index - 1 ][ 1 ] + 2 * point[ 1 ] + smoothed[ index + 1 ][ 1 ] ) * 0.25 ] );
	}

	const records = [];
	let travelled = 0, next = 0;
	for ( let index = 1; index < smoothed.length; index ++ ) {
		const [ ax, az ] = smoothed[ index - 1 ], [ bx, bz ] = smoothed[ index ];
		const dx = bx - ax, dz = bz - az, segmentLength = Math.hypot( dx, dz );
		if ( segmentLength <= 1e-8 ) continue;
		while ( next <= travelled + segmentLength ) {
			const t = ( next - travelled ) / segmentLength;
			const tx = dx / segmentLength, tz = dz / segmentLength;
			records.push( ax + dx * t, az + dz * t, - tz, tx );
			next += spacing;
		}
		travelled += segmentLength;
	}
	if ( records.length < 8 || records.length % 4 !== 0 ) throw new Error( 'Tidewater breaker shoreline did not produce enough stations' );
	return { data: new Float32Array( records ), count: records.length / 4, spacing };
}
