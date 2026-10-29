// Tidewater authored material roles. ElseMesh validates and dispatches these
// through its generic world material-profile registry.
export const VILLAGE_MATERIAL_PROFILE = 'elsemesh.village/1';
export const VILLAGE_MATERIAL_ROLES = Object.freeze( [ 'wood', 'hard', 'roofMetal', 'thatch', 'stone', 'fabric', 'net' ] );
export const VILLAGE_MATERIAL_RENDERER_PROFILE = 'original-elsemesh-village-v1';
export const VILLAGE_MATERIAL_MAPS = Object.freeze( [
	{ name: 'woodA', width: 1024, height: 1024, tileMeters: [ 2, 1 ], channels: [ 'weathered-albedo', 'paint-chip-mask' ] },
	{ name: 'woodN', width: 1024, height: 1024, tileMeters: [ 2, 1 ], channels: [ 'normal-x', 'normal-y', 'roughness', 'ambient-occlusion' ] },
	{ name: 'paintN', width: 512, height: 512, tileMeters: [ 1, 0.5 ], channels: [ 'normal-x', 'normal-y', 'roughness', 'ambient-occlusion' ] },
	{ name: 'roofA', width: 512, height: 1024, tileMeters: [ 0.84, 1.68 ], channels: [ 'rust', 'rust-variation', 'fade', 'grime' ] },
	{ name: 'roofN', width: 512, height: 1024, tileMeters: [ 0.84, 1.68 ], channels: [ 'normal-x', 'normal-y', 'roughness', 'ambient-occlusion' ] },
	{ name: 'thatchA', width: 1024, height: 1024, tileMeters: [ 1, 1 ], channels: [ 'albedo', 'albedo', 'albedo', 'tip-mask' ] },
	{ name: 'thatchN', width: 1024, height: 1024, tileMeters: [ 1, 1 ], channels: [ 'normal-x', 'normal-y', 'roughness', 'ambient-occlusion' ] },
	{ name: 'stoneA', width: 1024, height: 1024, tileMeters: [ 2, 2 ], channels: [ 'albedo', 'albedo', 'albedo', 'plaster-mask' ] },
	{ name: 'stoneN', width: 1024, height: 1024, tileMeters: [ 2, 2 ], channels: [ 'normal-x', 'normal-y', 'roughness', 'ambient-occlusion' ] },
	{ name: 'hardA', width: 512, height: 512, tileMeters: [ 1, 1 ], channels: [ 'rust', 'scratch', 'grime', 'unused' ] },
	{ name: 'hardN', width: 512, height: 512, tileMeters: [ 1, 1 ], channels: [ 'normal-x', 'normal-y', 'roughness', 'ambient-occlusion' ] },
	{ name: 'grime', width: 512, height: 512, tileMeters: [ 2, 2 ], channels: [ 'streaks', 'salt', 'spots', 'macro-variation' ] },
	{ name: 'rope', width: 256, height: 256, tileMeters: [ 1, 1 ], channels: [ 'shade', 'occlusion', 'normal-x', 'normal-y' ] },
	{ name: 'net', width: 256, height: 256, tileMeters: [ 0.2, 0.2 ], channels: [ 'alpha', 'shade', 'normal-x', 'normal-y' ] },
] );
