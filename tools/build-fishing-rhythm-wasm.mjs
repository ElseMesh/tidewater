#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateWorldExtensionBinary } from '../../../src/network/WorldExtensionBinary.js';

const worldRoot = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' );
const source = path.join( worldRoot, 'source/wasm/fishing-rhythm.c' );
const tempParent = process.env.PREFIX ? path.join( process.env.PREFIX, 'tmp' ) : '/var/tmp';
const temporary = await mkdtemp( path.join( tempParent, 'tidewater-wasm-' ) );
const object = path.join( temporary, 'fishing-rhythm.o' );
const linked = path.join( temporary, 'fishing-rhythm-linked.wasm' );

function run( command, args ) {
	const result = spawnSync( command, args, { encoding: 'utf8' } );
	if ( result.status !== 0 ) throw new Error( `${command} failed: ${result.stderr || result.stdout}` );
}

function readULEB( bytes, cursor ) {
	let value = 0, shift = 0;
	for ( let count = 0; count < 5; count ++ ) {
		if ( cursor.offset >= bytes.length ) throw new Error( 'Truncated WebAssembly section length' );
		const byte = bytes[ cursor.offset ++ ];
		if ( count === 4 && ( byte & 0xf0 ) !== 0 ) throw new Error( 'WebAssembly section length is out of range' );
		value += ( byte & 0x7f ) * 2 ** shift;
		if ( ( byte & 0x80 ) === 0 ) return value;
		shift += 7;
	}
	throw new Error( 'Invalid WebAssembly section length' );
}

function stripUnusedLinkerTable( bytes ) {
	const sections = [ bytes.subarray( 0, 8 ) ];
	let offset = 8, tableCount = 0, elementCount = 0;
	while ( offset < bytes.length ) {
		const start = offset, id = bytes[ offset ++ ], cursor = { offset };
		const size = readULEB( bytes, cursor ), end = cursor.offset + size;
		if ( end > bytes.length ) throw new Error( 'WebAssembly section exceeds module size' );
		if ( id === 4 ) {
			tableCount ++;
			const countCursor = { offset: cursor.offset };
			if ( readULEB( bytes, countCursor ) !== 1 ) throw new Error( 'Unexpected linker table count' );
		} else {
			if ( id === 9 ) elementCount ++;
			sections.push( bytes.subarray( start, end ) );
		}
		offset = end;
	}
	if ( tableCount !== 1 || elementCount !== 0 ) throw new Error( 'Expected one unused linker table and no element segments' );
	const result = new Uint8Array( sections.reduce( ( total, section ) => total + section.length, 0 ) );
	let destination = 0;
	for ( const section of sections ) { result.set( section, destination ); destination += section.length; }
	return result;
}

function verifyABI( bytes ) {
	validateWorldExtensionBinary( bytes );
	if ( ! WebAssembly.validate( bytes ) ) throw new Error( 'Linked extension is not valid WebAssembly 1.0' );
	const module = new WebAssembly.Module( bytes );
	const imports = WebAssembly.Module.imports( module );
	const exports = WebAssembly.Module.exports( module ).sort( ( a, b ) => a.name.localeCompare( b.name ) );
	const expected = [ 'abi_version', 'alloc', 'init', 'memory', 'output_len', 'step' ];
	if ( imports.length !== 1 || imports[ 0 ].module !== 'elsemesh_host_v1' || imports[ 0 ].name !== 'memory' || imports[ 0 ].kind !== 'memory' || exports.length !== expected.length || exports.some( ( item, index ) => item.name !== expected[ index ] || item.kind !== ( item.name === 'memory' ? 'memory' : 'function' ) ) ) throw new Error( 'Linked extension does not match the ElseMesh Wasm ABI' );
	const memory = new WebAssembly.Memory( { initial: 4, maximum: 4 } );
	return WebAssembly.instantiate( module, { elsemesh_host_v1: { memory } } ).then( ( { exports } ) => {
		if ( exports.abi_version() !== 1 ) throw new Error( 'Linked extension has an unsupported ABI version' );
		const encode = new TextEncoder(), decode = new TextDecoder();
		const call = ( name, input ) => {
			const data = encode.encode( JSON.stringify( input ) ), pointer = exports.alloc( data.length );
			new Uint8Array( memory.buffer, pointer, data.length ).set( data );
			const output = exports[ name ]( pointer, data.length ), length = exports.output_len();
			return JSON.parse( decode.decode( new Uint8Array( memory.buffer, output, length ) ) );
		};
		if ( call( 'init', {} ).biteRateMultiplier !== 1 || call( 'step', { timeOfDay: 6.5 } ).biteRateMultiplier !== 1.4 || call( 'step', { timeOfDay: 23 } ).biteRateMultiplier !== 0.8 ) throw new Error( 'Linked extension behavior check failed' );
		for ( let i = 0; i < 10000; i ++ ) call( 'step', { timeOfDay: 12 } );
		return call( 'step', { timeOfDay: 18 } );
	} );
}

try {
	run( 'clang', [ '--target=wasm32', '-O2', '-nostdlib', '-c', source, '-o', object ] );
	run( 'wasm-ld', [ '--no-entry', '--import-memory=elsemesh_host_v1,memory', '--initial-memory=262144', '--max-memory=262144', '--export=abi_version', '--export=alloc', '--export=init', '--export=output_len', '--export=step', '--export-memory', '--strip-all', '-o', linked, object ] );
	const bytes = stripUnusedLinkerTable( new Uint8Array( await readFile( linked ) ) );
	const finalState = await verifyABI( bytes );
	const digest = createHash( 'sha256' ).update( bytes ).digest( 'hex' );
	const assetPath = path.join( worldRoot, 'assets', digest );
	await mkdir( path.dirname( assetPath ), { recursive: true } );
	try {
		await writeFile( assetPath, bytes, { flag: 'wx' } );
	} catch ( error ) {
		if ( error.code !== 'EEXIST' || ! Buffer.from( await readFile( assetPath ) ).equals( Buffer.from( bytes ) ) ) throw error;
	}
	console.log( `sha256:${digest} ${path.relative( worldRoot, assetPath )} (${bytes.length} bytes), final step ${JSON.stringify( finalState )}` );
} finally {
	const { rm } = await import( 'node:fs/promises' );
	await rm( temporary, { recursive: true, force: true } );
}
