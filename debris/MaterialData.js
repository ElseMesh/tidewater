import { Color } from '../../../src/engine/math/Color.js';

// Tidewater's shoreline debris uses the built-in village material attribute
// layout; keep its authored palette and packed values with the world shapes.
const _color = new Color();

export const lin = ( hex ) => {
	_color.setHex( hex );
	return [ _color.r, _color.g, _color.b ];
};

export const mulc = ( color, factor ) => [ color[ 0 ] * factor, color[ 1 ] * factor, color[ 2 ] * factor ];
export const WOOD = ( seed, weather = 0.7, paint = 0, pattern = 0 ) => [ seed, paint, pattern, weather ];
export const HARD = ( seed, rust = 0, metal = 0, rough = 0.5 ) => [ seed, rust, metal, rough ];

export const C = {
	iron: lin( 0x1d1c1b ),
	galv: lin( 0x9aa0a2 ),
	rubber: lin( 0x141414 ),
	brass: lin( 0xb08d4a ),
	rope: lin( 0xb49a6c ),
	ropeDark: lin( 0x7d6a4a ),
	ropeBlue: lin( 0x3e6f8e ),
	white: lin( 0xf2efe6 ),
	orange: lin( 0xe8622a ),
	red: lin( 0xc23b2e ),
	yellow: lin( 0xf0c23a ),
	green: lin( 0x3f7f55 ),
	blue: lin( 0x2f6fa8 ),
	black: lin( 0x202020 ),
	fishSilver: lin( 0x9aa6ad ),
	fishDry: lin( 0x8a6a45 ),
	glassWarm: lin( 0xfff0d0 ),
	straw: lin( 0xc9b27a ),
};
