import { createWebGPUMaterialGraph } from '../../../../src/materials/WorldMaterialGraph.js';
import { VillageTextures } from './TextureBaker.js';
import { TIDEWATER_NET_MATERIAL_GRAPH, TIDEWATER_WOOD_MATERIAL_GRAPH, TIDEWATER_THATCH_MATERIAL_GRAPH, TIDEWATER_FABRIC_MATERIAL_GRAPH, TIDEWATER_STONE_MATERIAL_GRAPH, TIDEWATER_ROOF_METAL_MATERIAL_GRAPH, TIDEWATER_HARD_MATERIAL_GRAPH, TIDEWATER_GLASS_MATERIAL_GRAPH } from '../../VillageMaterialGraphs.js';

// The world-authored graphs below are compiled by the engine for its selected backend.

// ---------------------------------------------------------------------------
// WOOD: raw and painted timber.
// vdata: x seed, y paint (0 raw, 0.3 heavily worn .. 1 fresh; < 0: raw deck board with a worn walking
//        path along it, centred at u = -paint - 1), z pattern, w weathering (0 fresh .. 1 silver)
// World-space weathering on every piece: rain / rust streaks down vertical faces, bird droppings on
// upward faces above head height, the tidal belt near the water (vlmTidal).
// patterns: 0 plain, 1 lap siding, 2 board & batten, 3 vertical tongue & groove,
//           4 louvers, 5 planks along u (staves, clinker), 6 horizontal planks (flush),
//           7 nailed deck plank (nail heads + rust stains every 0.8 m),
//           9 GLASS (window panes / lantern glass): vdata = seed, kind (0 window, 1 lantern), 9, lit
// tint: paint color when painted, otherwise a wood tone multiplier.
// uv: metres, u along the grain; end-grain faces are flagged with u + 1000, post tops with u + 2000.

export function createWoodMaterial( T ) {
	const material = createWebGPUMaterialGraph( {
		name: 'VillageWood',
		pbrMetallicRoughness: { roughnessFactor: 0.85, metallicFactor: 0 },
	}, TIDEWATER_WOOD_MATERIAL_GRAPH, {
		graphTextures: {
			baseColor: T.woodA,
			metallicRoughness: T.woodN,
			normal: T.paintN,
			emissive: T.grime,
		},
	} );
	material.name = 'VillageWood';
	return material;
}

// ---------------------------------------------------------------------------
// CORRUGATED METAL ROOFING
// uv: u = distance up-slope from the eave (m), v = along the eave (m)
// vdata: x seed, y rust amount, z galvanized (1) / painted (0)

export function createRoofMetalMaterial( T ) {
	const m = createWebGPUMaterialGraph( {
		name: 'VillageRoofMetal',
		pbrMetallicRoughness: { roughnessFactor: 0.5, metallicFactor: 0.2 },
	}, TIDEWATER_ROOF_METAL_MATERIAL_GRAPH, {
		graphTextures: { metallicRoughness: T.roofA, normal: T.roofN, occlusion: T.hardN },
	} );
	m.name = 'VillageRoofMetal';
	return m;

}

// ---------------------------------------------------------------------------
// PALM THATCH
// uv: u = distance up-slope from the eave (m), v = along the eave (m)
// vdata: x seed, y age (0 golden .. 1 grey)

export function createThatchMaterial( T ) {
	const m = createWebGPUMaterialGraph( {
		name: 'VillageThatch',
		doubleSided: false,
		pbrMetallicRoughness: { roughnessFactor: 0.95, metallicFactor: 0 },
	}, TIDEWATER_THATCH_MATERIAL_GRAPH, {
		graphTextures: { metallicRoughness: T.thatchA, normal: T.thatchN, occlusion: T.grime },
	} );
	m.name = 'VillageThatch';
	return m;

}

// ---------------------------------------------------------------------------
// HARD SURFACES: iron, steel, galvanized, rubber, plastic, painted metal - and rope.
// vdata: x seed, y rust (0..1), z metalness, w roughness
// rope: vdata.w = 2 + rope radius (uv: u along the rope, v around, metres)

export function createHardMaterial( T ) {
	const m = createWebGPUMaterialGraph( {
		name: 'VillageHard',
		pbrMetallicRoughness: { roughnessFactor: 0.5, metallicFactor: 0.5 },
	}, TIDEWATER_HARD_MATERIAL_GRAPH, {
		graphTextures: { metallicRoughness: T.hardA, normal: T.hardN, occlusion: T.rope, emissive: T.grime },
	} );
	m.name = 'VillageHard';
	return m;

}

// Window and lantern light uses the same signed graph in WebGPU and WebGL.
export function createGlassMaterial( T ) {
	const material = createWebGPUMaterialGraph( {
		name: 'VillageGlass',
		pbrMetallicRoughness: { roughnessFactor: 0.2, metallicFactor: 0 },
		emissiveFactor: [ 0, 0, 0 ],
	}, TIDEWATER_GLASS_MATERIAL_GRAPH, {
		graphTextures: { emissive: T.grime },
	} );
	material.name = 'VillageGlass';
	return material;
}

// ---------------------------------------------------------------------------
// Rubble, plaster, end grain, and ground dust share the signed renderer-neutral graph.
export function createStoneMaterial( T ) {
	const m = createWebGPUMaterialGraph( {
		name: 'VillageStone',
		pbrMetallicRoughness: { roughnessFactor: 0.92, metallicFactor: 0 },
	}, TIDEWATER_STONE_MATERIAL_GRAPH, {
		graphTextures: { baseColor: T.stoneA, normal: T.stoneN, metallicRoughness: T.paintN, occlusion: T.grime },
	} );
	m.name = 'VillageStone';
	return m;
}

// Cloth, tarps, nets, and flags share the signed renderer-neutral graph.
export function createFabricMaterial( T ) {
	const m = createWebGPUMaterialGraph( {
		name: 'VillageFabric',
		doubleSided: true,
		alphaMode: 'MASK',
		alphaCutoff: 0.5,
		pbrMetallicRoughness: { roughnessFactor: 0.88, metallicFactor: 0 },
	}, TIDEWATER_FABRIC_MATERIAL_GRAPH, {
		graphTextures: { metallicRoughness: T.net, occlusion: T.grime },
	} );
	m.name = 'VillageFabric';
	return m;
}

// ---------------------------------------------------------------------------
// NETS: blended, no depth write. Knotted mesh up close (soft-edged strands from the net texture);
// further away the strands average into a see-through veil of the right coverage. Alpha testing
// (or dithering) the sub-pixel strands wrote a noisy foreground depth over whatever is behind the net,
// and the TAA reprojected the background with it: grain and ghosted houses behind every net.
// vdata as for FABRIC nets: x seed, y sway weight, z mesh size (m).

function createNetMaterial( textures ) {
	const material = createWebGPUMaterialGraph( {
		name: 'VillageNet', doubleSided: true, alphaMode: 'BLEND',
		pbrMetallicRoughness: { baseColorFactor: [ 1, 1, 1, 1 ], roughnessFactor: 0.9, metallicFactor: 0 },
	}, TIDEWATER_NET_MATERIAL_GRAPH, { graphTextures: { metallicRoughness: textures.net } } );
	material.name = 'VillageNet';
	return material;
}

export function createVillageMaterials( textures = new VillageTextures() ) {

	const T = textures.textures;
	return {
		wood: createWoodMaterial( T ),
		glass: createGlassMaterial( T ),
		roofMetal: createRoofMetalMaterial( T ),
		thatch: createThatchMaterial( T ),
		hard: createHardMaterial( T ),
		stone: createStoneMaterial( T ),
		fabric: createFabricMaterial( T ),
		net: createNetMaterial( T ),
	};

}
