// Renderer-neutral authored settings shared by Tidewater's canopy bake and
// current presenters. Keep backend shader code out of this profile.
export const TIDEWATER_CANOPY_PROFILE = Object.freeze( {
	format: 'tidewater.canopy-source-profile/1',
	framesPerSide: 6,
	frameWidth: 128,
	variantSelectionMultiplier: 7.77,
	variants: Object.freeze( { trees: 3, shrubs: 2 } ),
	lod: Object.freeze( {
		treeNearDistance: 65,
		shrubNearDistance: 45,
		frameBlendDistance: 100,
		bandFraction: 0.12,
		treeMaxDistance: 2800,
		treeFadeStartDistance: 2600,
		shrubMaxDistance: 180,
		thinningStartDistance: 140,
		thinningEndDistance: 320,
		thinningRemoveFraction: 0.5,
		thinningSeedMultiplier: 91.7,
	} ),
	species: Object.freeze( {
		treeSeedMultiplier: 5.31,
		shrubSeedMultiplier: 3.17,
		shrubSeaGrapeThreshold: 0.45,
		shrubCrotonThreshold: 0.6,
		dryTreeChance: 0.035,
		floweringTreeThreshold: 0.988,
	} ),
	palette: Object.freeze( {
		trees: Object.freeze( [
			Object.freeze( { low: 0x283a1b, high: 0x364a23, dry: 0x5e4a2e, dryStart: 0.96, dryEnd: 0.995, dryMix: 0.5 } ),
			Object.freeze( { low: 0x34491f, high: 0x485c27 } ),
			Object.freeze( { low: 0x4f5a27, high: 0x646a31 } ),
			Object.freeze( { low: 0x2a3b2a, high: 0x3a4a36 } ),
		] ),
		shrubs: Object.freeze( [
			Object.freeze( { low: 0x3f5522, high: 0x52662a } ),
			Object.freeze( { low: 0x2c421e, high: 0x44561f } ),
			Object.freeze( { low: 0x34521c, high: 0x466624 } ),
		] ),
		bark: Object.freeze( { dark: 0x302a22, mid: 0x5c5549, pale: 0x7b7b6a, paleStart: 0.64, paleEnd: 0.8, paleMix: 0.3 } ),
		dryTree: Object.freeze( { low: 0x5c5234, high: 0x6e5a3a, mix: 0.5 } ),
		floweringTree: 0x8a4a2c,
	} ),
	color: Object.freeze( {
		instanceTintScale: 0.36,
		instanceTintBias: 0.74,
		leafDesaturation: 0.85,
		impostorBrightnessScale: 1.4,
		barkDark: 0x1c1a13,
		barkLight: 0x2e2b20,
		leafBlendStart: 0.05,
		leafBlendEnd: 0.55,
		impostorSaturation: 1.25,
	} ),
	lighting: Object.freeze( {
		bakedOcclusionFloor: 0.26,
		bakedOcclusionExponent: 2,
		brightnessScale: 0.6,
		brightnessBias: 0.7,
		roughness: 0.85,
		specularIntensity: 0.12,
		translucency: 0.35,
	} ),
	wind: Object.freeze( {
		gustAmplitude: 0.009,
		gustBias: 0.3,
		gustScale: 0.8,
		waveAmplitude: 0.0045,
		waveFrequency: 0.9,
		waveGustBias: 0.4,
		seedPhaseScale: 6.2832,
		heightScale: 0.45,
	} ),
} );

// Runtime canopy inputs are a small renderer-neutral projection of the bake
// profile. Backend shader code remains in ElseMesh adapters.
export const TIDEWATER_CANOPY_APPEARANCE = Object.freeze( {
	format: 'elsemesh.canopy-appearance/1',
	color: TIDEWATER_CANOPY_PROFILE.color,
	lighting: TIDEWATER_CANOPY_PROFILE.lighting,
	wind: TIDEWATER_CANOPY_PROFILE.wind,
	palette: TIDEWATER_CANOPY_PROFILE.palette,
	species: Object.freeze( {
		treeSeedMultiplier: TIDEWATER_CANOPY_PROFILE.species.treeSeedMultiplier,
		shrubSeedMultiplier: TIDEWATER_CANOPY_PROFILE.species.shrubSeedMultiplier,
		shrubVariantThresholds: Object.freeze( [ TIDEWATER_CANOPY_PROFILE.species.shrubSeaGrapeThreshold, TIDEWATER_CANOPY_PROFILE.species.shrubCrotonThreshold ] ),
		dryTreeChance: TIDEWATER_CANOPY_PROFILE.species.dryTreeChance,
		floweringTreeThreshold: TIDEWATER_CANOPY_PROFILE.species.floweringTreeThreshold,
	} ),
} );
