// Run the signed debris package through both renderers and compare matched-view masks.
//   node --preserve-symlinks worlds/tidewater/test/scanned-debris-render-parity.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const scratch = mkdtempSync( '/var/tmp/tidewater-scanned-debris-parity-' );
const outputs = [
	{ backend: 'WebGPU', script: 'worlds/tidewater/test/webgpu-scanned-debris-package-render.mjs', image: join( scratch, 'webgpu.png' ) },
	{ backend: 'WebGL', script: 'worlds/tidewater/test/webgl-scanned-debris-package-render.mjs', image: join( scratch, 'webgl.png' ) },
];

function runFixture( fixture ) {
	const run = spawnSync( process.execPath, [ '--preserve-symlinks', fixture.script, fixture.image ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 } );
	if ( run.stdout ) process.stdout.write( run.stdout );
	if ( run.stderr ) process.stderr.write( run.stderr );
	if ( run.error ) throw run.error;
	assert.equal( run.status, 0, `${fixture.backend} signed debris render fixture exits successfully` );
	const match = run.stdout.match( /(\d+) pixels, (\d+) placements, (\d+)(?: signed)? textures, LOD (\d+) \((sha256:[0-9a-f]{64})\)/ );
	assert( match, `${fixture.backend} fixture reports placements, texture loads, selected LOD, and its signed GLB` );
	return { backend: fixture.backend, pixels: Number( match[ 1 ] ), placements: Number( match[ 2 ] ), textures: Number( match[ 3 ] ), lod: Number( match[ 4 ] ), asset: match[ 5 ], image: fixture.image };
}

function rgbaImage( path ) {
	const [ width, height ] = execFileSync( 'identify', [ '-format', '%w %h', path ], { encoding: 'utf8' } ).split( /\s+/ ).map( Number );
	const pixels = execFileSync( 'convert', [ path, '-depth', '8', 'rgba:-' ], { maxBuffer: width * height * 4 + 1024 } );
	assert.equal( pixels.length, width * height * 4, `${path} decodes to a complete RGBA image` );
	return { width, height, pixels };
}

function foregroundCoverageWithinOnePixel( source, target, width, height ) {
	let matched = 0, total = 0;
	for ( let pixel = 0; pixel < source.length; pixel ++ ) {
		if ( ! source[ pixel ] ) continue;
		total ++;
		const x = pixel % width, y = Math.floor( pixel / width );
		let found = false;
		for ( let dy = - 1; dy <= 1 && ! found; dy ++ ) for ( let dx = - 1; dx <= 1; dx ++ ) {
			const nx = x + dx, ny = y + dy;
			if ( nx >= 0 && nx < width && ny >= 0 && ny < height && target[ ny * width + nx ] ) { found = true; break; }
		}
		if ( found ) matched ++;
	}
	return { matched, total, coverage: matched / total };
}

try {
	const results = outputs.map( runFixture );
	assert.equal( results[ 0 ].placements, results[ 1 ].placements, 'both renderers consume the same authored placements' );
	assert.equal( results[ 0 ].asset, results[ 1 ].asset, 'both renderers select the same signed model LOD asset' );
	assert.equal( results[ 0 ].lod, results[ 1 ].lod, 'both renderers select the same LOD index' );
	const [ webgpu, webgl ] = results.map( result => rgbaImage( result.image ) );
	assert.deepEqual( [ webgpu.width, webgpu.height ], [ webgl.width, webgl.height ], 'backend captures use the same viewport dimensions' );
	let intersection = 0, union = 0, colorError = 0;
	const foreground = image => {
		const background = image.pixels.subarray( 0, 3 );
		const mask = new Uint8Array( image.width * image.height );
		for ( let pixel = 0; pixel < mask.length; pixel ++ ) {
			const offset = pixel * 4;
			mask[ pixel ] = Math.abs( image.pixels[ offset ] - background[ 0 ] ) + Math.abs( image.pixels[ offset + 1 ] - background[ 1 ] ) + Math.abs( image.pixels[ offset + 2 ] - background[ 2 ] ) > 24 ? 1 : 0;
		}
		return mask;
	};
	const masks = [ foreground( webgpu ), foreground( webgl ) ];
	for ( let pixel = 0; pixel < masks[ 0 ].length; pixel ++ ) {
		const a = masks[ 0 ][ pixel ], b = masks[ 1 ][ pixel ];
		if ( a || b ) union ++;
		if ( ! a || ! b ) continue;
		intersection ++;
		const offset = pixel * 4;
		for ( let channel = 0; channel < 3; channel ++ ) colorError += Math.abs( webgpu.pixels[ offset + channel ] - webgl.pixels[ offset + channel ] );
	}
	const iou = intersection / union, rgbMae = colorError / ( intersection * 3 );
	const coverageGPU = foregroundCoverageWithinOnePixel( masks[ 0 ], masks[ 1 ], webgpu.width, webgpu.height );
	const coverageGL = foregroundCoverageWithinOnePixel( masks[ 1 ], masks[ 0 ], webgpu.width, webgpu.height );
	const onePixelCoverage = ( coverageGPU.matched + coverageGL.matched ) / ( coverageGPU.total + coverageGL.total );
	assert( iou >= 0.9, `same-LOD debris foreground silhouettes overlap (IoU ${iou.toFixed( 3 )})` );
	assert( onePixelCoverage >= 0.97, `same-LOD debris silhouette coverage within one pixel (${onePixelCoverage.toFixed( 3 )})` );
	console.log( `Tidewater scanned-debris matched view: exact foreground IoU ${iou.toFixed( 3 )}, symmetric coverage within one pixel ${onePixelCoverage.toFixed( 3 )}; overlapping foreground RGB MAE ${rgbMae.toFixed( 2 )}/255; textures loaded WebGPU/WebGL ${results[ 0 ].textures}/${results[ 1 ].textures}` );
} finally {
	rmSync( scratch, { recursive: true, force: true } );
}

