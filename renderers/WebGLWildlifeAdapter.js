import { SPECIES } from '../wildlife/BirdSpecies.js';
import { buildBird } from '../wildlife/BirdShapes.js';
import { forEachVisibleWildlifeBird } from '../wildlife/WildlifeFrame.js';
import { WebGLCrabAdapter } from './WebGLCrabAdapter.js';

const speciesGeometry = SPECIES.map( buildBird );
const vertexScratch = new Float32Array( 3 );
const normalScratch = new Float32Array( 3 );
const rotateA = [ 0, 0, 0 ], rotateB = [ 0, 0, 0 ], rotateC = [ 0, 0, 0 ];

function rotateInto( q, px, py, pz, out ) {
	const x = q[ 0 ], y = q[ 1 ], z = q[ 2 ], w = q[ 3 ];
	const tx = 2 * ( y * pz - z * py ), ty = 2 * ( z * px - x * pz ), tz = 2 * ( x * py - y * px );
	out[ 0 ] = px + w * tx + y * tz - z * ty;
	out[ 1 ] = py + w * ty + z * tx - x * tz;
	out[ 2 ] = pz + w * tz + x * ty - y * tx;
	return out;
}

function smoothstep( a, b, x ) { const t = Math.max( 0, Math.min( 1, ( x - a ) / ( b - a ) ) ); return t * t * ( 3 - 2 * t ); }

function prepareWing( shape, pose, side ) {
	const { S, E, W } = shape.joints;
	const sx = S[ 0 ] * side, sy = S[ 1 ], sz = S[ 2 ];
	const ex = E[ 0 ] * side, ey = E[ 1 ], ez = E[ 2 ];
	const wx = W[ 0 ] * side, wy = W[ 1 ], wz = W[ 2 ];
	const mirror = ( q ) => [ q[ 0 ], q[ 1 ] * side, q[ 2 ] * side, q[ 3 ] ];
	const a = mirror( pose.QA ), b = mirror( pose.QB ), c = mirror( pose.QC );
	rotateInto( a, ex - sx, ey - sy, ez - sz, rotateA );
	const epx = sx + rotateA[ 0 ], epy = sy + rotateA[ 1 ], epz = sz + rotateA[ 2 ];
	rotateInto( b, wx - ex, wy - ey, wz - ez, rotateA );
	const wpx = epx + rotateA[ 0 ], wpy = epy + rotateA[ 1 ], wpz = epz + rotateA[ 2 ];
	return { sx, sy, sz, ex, ey, ez, wx, wy, wz, epx, epy, epz, wpx, wpy, wpz, a, b, c };
}

function prepareLegs( species, pose ) {
	const sides = [];
	for ( const side of [ - 1, 1 ] ) {
		const hip = species.legs.hip, hx = hip[ 0 ] * side, hy = hip[ 1 ], hz = hip[ 2 ];
		const knee = side > 0 ? pose.kneeL : pose.kneeR, foot = side > 0 ? pose.footL : pose.footR;
		const kx = knee[ 0 ], ky = knee[ 1 ], kz = knee[ 2 ], fx = foot[ 0 ], fy = foot[ 1 ], fz = foot[ 2 ];
		const dkx = kx - hx, dky = ky - hy, dkz = kz - hz;
		const dfx = fx - hx, dfy = fy - hy, dfz = fz - hz;
		const dtx = fx - kx, dty = fy - ky, dtz = fz - kz;
		const legLength = Math.hypot( dkx, dky, dkz ) + Math.hypot( dtx, dty, dtz );
		const radius = species.legs.r * smoothstep( 0, 0.01, legLength );
		const footScale = smoothstep( 0, 0.01, Math.hypot( dtx, dty, dtz ) );
		const segments = [];
		for ( const [ cx, cy, cz, dx, dy, dz ] of [ [ hx, hy, hz, dkx, dky, dkz ], [ kx, ky, kz, dfx, dfy, dfz ], [ fx, fy, fz, dtx, dty, dtz ] ] ) {
			const dl = Math.hypot( dx, dy, dz ) || 1, ux = dx / dl, uy = dy / dl, uz = dz / dl;
			const ax0 = uy * 0.001, ay0 = uz - ux * 0.001, az0 = - uy;
			const al = Math.hypot( ax0, ay0, az0 ) || 1, ax = ax0 / al, ay = ay0 / al, az = az0 / al;
			segments.push( { cx, cy, cz, ax, ay, az, ux: uy * az - uz * ay, uy: uz * ax - ux * az, uz: ux * ay - uy * ax } );
		}
		sides[ side > 0 ? 1 : 0 ] = { knee, foot, segments, radius, footScale };
	}
	return sides;
}

function prepareWebGLBirdDeformation( shape, species, pose ) {
	return {
		shape, species, pose,
		wings: [ prepareWing( shape, pose, - 1 ), prepareWing( shape, pose, 1 ) ],
		legs: prepareLegs( species, pose ),
		tailCos: Math.cos( pose.tailPitch ), tailSin: Math.sin( pose.tailPitch ),
	};
}

function deformPreparedBirdVertex( deformation, index, out, normalOut = null ) {
	const { shape, species, pose } = deformation, o = index * 4, A = shape.A, B = shape.B, C = shape.C, D = shape.D;
	const px = A[ o ], py = A[ o + 1 ], pz = A[ o + 2 ], part = A[ o + 3 ];
	if ( part < 3.5 ) {
		const pivot = species.pivot;
		rotateInto( pose.qH, px - pivot[ 0 ], py - pivot[ 1 ], pz - pivot[ 2 ], rotateA );
		const hx = pivot[ 0 ] + pose.headOff[ 0 ] + rotateA[ 0 ], hy = pivot[ 1 ] + pose.headOff[ 1 ] + rotateA[ 1 ], hz = pivot[ 2 ] + pose.headOff[ 2 ] + rotateA[ 2 ];
		const weight = part < 2.5 ? B[ o + 3 ] : 0;
		out[ 0 ] = hx + ( px - hx ) * weight; out[ 1 ] = hy + ( py - hy ) * weight; out[ 2 ] = hz + ( pz - hz ) * weight;
		if ( normalOut ) {
			rotateInto( pose.qH, B[ o ], B[ o + 1 ], B[ o + 2 ], rotateB );
			normalOut[ 0 ] = rotateB[ 0 ] + ( B[ o ] - rotateB[ 0 ] ) * weight;
			normalOut[ 1 ] = rotateB[ 1 ] + ( B[ o + 1 ] - rotateB[ 1 ] ) * weight;
			normalOut[ 2 ] = rotateB[ 2 ] + ( B[ o + 2 ] - rotateB[ 2 ] ) * weight;
		}
	} else if ( part < 4.5 ) {
		const tailY = species.tail.y, tailZ = species.tail.z;
		const dx = ( px ) * pose.tailSpread, dy = py - tailY, dz = pz - tailZ, c = deformation.tailCos, s = deformation.tailSin;
		out[ 0 ] = dx; out[ 1 ] = tailY + dy * c + dz * s; out[ 2 ] = tailZ + dz * c - dy * s;
		if ( normalOut ) {
			normalOut[ 0 ] = B[ o ]; normalOut[ 1 ] = B[ o + 1 ] * c + B[ o + 2 ] * s; normalOut[ 2 ] = B[ o + 2 ] * c - B[ o + 1 ] * s;
		}
	} else if ( part < 7.5 ) {
		const wing = deformation.wings[ px < 0 ? 0 : 1 ], seg = part - 5, w = B[ o + 3 ];
		rotateInto( wing.a, px - wing.sx, py - wing.sy, pz - wing.sz, rotateA );
		const pax = wing.sx + rotateA[ 0 ], pay = wing.sy + rotateA[ 1 ], paz = wing.sz + rotateA[ 2 ];
		rotateInto( wing.b, px - wing.ex, py - wing.ey, pz - wing.ez, rotateB );
		const pbx = wing.epx + rotateB[ 0 ], pby = wing.epy + rotateB[ 1 ], pbz = wing.epz + rotateB[ 2 ];
		rotateInto( wing.c, px - wing.wx, py - wing.wy, pz - wing.wz, rotateC );
		const pcx = wing.wpx + rotateC[ 0 ], pcy = wing.wpy + rotateC[ 1 ], pcz = wing.wpz + rotateC[ 2 ];
		let x, y, z;
		if ( seg < 0.5 ) { x = pax; y = pay; z = paz; }
		else if ( seg < 1.5 ) { x = pbx + ( pax - pbx ) * w; y = pby + ( pay - pby ) * w; z = pbz + ( paz - pbz ) * w; }
		else { x = pcx + ( pbx - pcx ) * w; y = pcy + ( pby - pcy ) * w; z = pcz + ( pbz - pcz ) * w; }
		const fold = pose.fold;
		out[ 0 ] = x + ( C[ o ] - x ) * fold; out[ 1 ] = y + ( C[ o + 1 ] - y ) * fold; out[ 2 ] = z + ( C[ o + 2 ] - z ) * fold;
		if ( normalOut ) {
			rotateInto( wing.a, B[ o ], B[ o + 1 ], B[ o + 2 ], rotateA );
			const nax = rotateA[ 0 ], nay = rotateA[ 1 ], naz = rotateA[ 2 ];
			rotateInto( wing.b, B[ o ], B[ o + 1 ], B[ o + 2 ], rotateB );
			const nbx = rotateB[ 0 ], nby = rotateB[ 1 ], nbz = rotateB[ 2 ];
			rotateInto( wing.c, B[ o ], B[ o + 1 ], B[ o + 2 ], rotateC );
			const ncx = rotateC[ 0 ], ncy = rotateC[ 1 ], ncz = rotateC[ 2 ];
			let nx, ny, nz;
			if ( seg < 0.5 ) { nx = nax; ny = nay; nz = naz; }
			else if ( seg < 1.5 ) { nx = nbx + ( nax - nbx ) * w; ny = nby + ( nay - nby ) * w; nz = nbz + ( naz - nbz ) * w; }
			else { nx = ncx + ( nbx - ncx ) * w; ny = ncy + ( nby - ncy ) * w; nz = ncz + ( nbz - ncz ) * w; }
			normalOut[ 0 ] = nx + ( D[ o ] - nx ) * fold; normalOut[ 1 ] = ny + ( D[ o + 1 ] - ny ) * fold; normalOut[ 2 ] = nz + ( D[ o + 2 ] - nz ) * fold;
		}
	} else {
		const side = A[ o ], seg = A[ o + 1 ], leg = deformation.legs[ side > 0 ? 1 : 0 ];
		if ( seg > 2.5 ) {
			out[ 0 ] = leg.foot[ 0 ] + C[ o ] * leg.footScale;
			out[ 1 ] = leg.foot[ 1 ] + C[ o + 1 ] * leg.footScale;
			out[ 2 ] = leg.foot[ 2 ] + C[ o + 2 ] * leg.footScale;
			if ( normalOut ) { normalOut[ 0 ] = 0; normalOut[ 1 ] = 1; normalOut[ 2 ] = 0; }
		} else {
			const segment = leg.segments[ seg < 0.5 ? 0 : seg < 1.5 ? 1 : 2 ];
			const radius = leg.radius * B[ o + 2 ];
			const rx = segment.ax * B[ o ] + segment.ux * B[ o + 1 ], ry = segment.ay * B[ o ] + segment.uy * B[ o + 1 ], rz = segment.az * B[ o ] + segment.uz * B[ o + 1 ];
			out[ 0 ] = segment.cx + rx * radius; out[ 1 ] = segment.cy + ry * radius; out[ 2 ] = segment.cz + rz * radius;
			if ( normalOut ) { normalOut[ 0 ] = rx; normalOut[ 1 ] = ry; normalOut[ 2 ] = rz; }
		}
	}
	return out;
}

// CPU execution uses the same shared topology and pose as BirdBatch, but prepares joint
// transforms once per bird instead of rebuilding them, with temporary arrays, for every vertex.
export function deformWebGLBirdVertex( shape, species, pose, index, out = [ 0, 0, 0 ], normalOut = null ) {
	return deformPreparedBirdVertex( prepareWebGLBirdDeformation( shape, species, pose ), index, out, normalOut );
}

const COLORS = [
	[ [ 0.92, 0.92, 0.9 ], [ 0.42, 0.44, 0.46 ], [ 0.06, 0.06, 0.07 ], [ 0.42, 0.08, 0.07 ], [ 0.16, 0.07, 0.07 ] ],
	[ [ 0.94, 0.94, 0.92 ], [ 0.68, 0.71, 0.74 ], [ 0.08, 0.08, 0.09 ], [ 0.95, 0.42, 0.08 ], [ 0.04, 0.04, 0.04 ] ],
	[ [ 0.48, 0.44, 0.38 ], [ 0.52, 0.5, 0.46 ], [ 0.12, 0.11, 0.1 ], [ 0.6, 0.54, 0.48 ], [ 0.12, 0.12, 0.12 ] ],
	[ [ 0.06, 0.06, 0.07 ], [ 0.08, 0.08, 0.09 ], [ 0.05, 0.05, 0.06 ], [ 0.5, 0.52, 0.56 ], [ 0.32, 0.28, 0.28 ] ],
	[ [ 0.92, 0.92, 0.9 ], [ 0.56, 0.57, 0.55 ], [ 0.14, 0.14, 0.14 ], [ 0.05, 0.05, 0.05 ], [ 0.04, 0.04, 0.04 ] ],
];

export class WebGLWildlifeAdapter {
	constructor( THREE, scene, terrain ) {
		this.THREE = THREE; this.scene = scene; this.meshes = new Map(); this.shapes = speciesGeometry;
		this.material = new THREE.MeshStandardMaterial( { vertexColors: true, roughness: 0.78, side: THREE.DoubleSide } );
		this.crabs = new WebGLCrabAdapter( THREE, scene, terrain );
	}

	createMesh( pose ) {
		const THREE = this.THREE, speciesIndex = pose.species, shape = this.shapes[ speciesIndex ], species = SPECIES[ speciesIndex ];
		const positions = new Float32Array( shape.count * 3 ), normals = new Float32Array( shape.count * 3 ), colors = new Float32Array( shape.count * 3 );
		for ( let i = 0; i < shape.count; i ++ ) {
			const o = i * 4, part = shape.A[ o + 3 ], palette = COLORS[ speciesIndex ];
			const color = part < 3.5 ? palette[ 0 ] : part < 4.5 ? palette[ 1 ] : part < 7.5 ? palette[ 1 ] : part < 8.5 ? palette[ 4 ] : palette[ 3 ];
			colors.set( color, i * 3 );
		}
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ).setUsage( THREE.DynamicDrawUsage ) );
		geometry.setAttribute( 'normal', new THREE.BufferAttribute( normals, 3 ).setUsage( THREE.DynamicDrawUsage ) );
		geometry.setAttribute( 'color', new THREE.BufferAttribute( colors, 3 ) ); geometry.setIndex( shape.index );
		const mesh = new THREE.Mesh( geometry, this.material );
		mesh.name = `WebGL ${species.name}`; mesh.castShadow = true; mesh.receiveShadow = true;
		mesh.userData.shape = shape; mesh.userData.species = species;
		this.scene.add( mesh ); return mesh;
	}

	update( runtime, camera ) {
		const active = new Set();
		forEachVisibleWildlifeBird( runtime, camera, ( pose, scaledPose ) => {
			let mesh = this.meshes.get( pose );
			if ( ! mesh ) { mesh = this.createMesh( pose ); this.meshes.set( pose, mesh ); }
			active.add( pose ); mesh.visible = true;
			const { shape, species } = mesh.userData, position = mesh.geometry.attributes.position, normal = mesh.geometry.attributes.normal;
			const deformation = prepareWebGLBirdDeformation( shape, species, pose );
			for ( let i = 0; i < shape.count; i ++ ) {
				deformPreparedBirdVertex( deformation, i, vertexScratch, normalScratch );
				const offset = i * 3;
				position.array[ offset ] = vertexScratch[ 0 ]; position.array[ offset + 1 ] = vertexScratch[ 1 ]; position.array[ offset + 2 ] = vertexScratch[ 2 ];
				normal.array[ offset ] = normalScratch[ 0 ]; normal.array[ offset + 1 ] = normalScratch[ 1 ]; normal.array[ offset + 2 ] = normalScratch[ 2 ];
			}
			position.needsUpdate = true; normal.needsUpdate = true;
			mesh.scale.setScalar( scaledPose );
			mesh.position.set( ...pose.pos ); mesh.quaternion.fromArray( pose.q );
		} );
		for ( const [ pose, mesh ] of this.meshes ) if ( ! active.has( pose ) ) mesh.visible = false;
		this.crabs.update( runtime.crabs, camera.position );
	}

	dispose() {
		for ( const mesh of this.meshes.values() ) { this.scene.remove( mesh ); mesh.geometry.dispose(); }
		this.meshes.clear(); this.material.dispose();
		this.crabs.dispose();
	}
}
