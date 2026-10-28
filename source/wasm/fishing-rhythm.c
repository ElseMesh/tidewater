typedef unsigned int u32;

extern unsigned char __heap_base;

static u32 heap_cursor;
static u32 result_size;
static const char dawn[] = "{\"biteRateMultiplier\":1.4}";
static const char night[] = "{\"biteRateMultiplier\":0.8}";
static const char day[] = "{\"biteRateMultiplier\":1.0}";

__attribute__((export_name("abi_version"))) u32 abi_version(void) {
	return 1;
}

__attribute__((export_name("alloc"))) u32 alloc(u32 length) {
	if ( ! heap_cursor ) heap_cursor = (u32) &__heap_base;
	const u32 pointer = ( heap_cursor + 7u ) & ~7u;
	heap_cursor = pointer + length;
	return pointer;
}

static u32 output(const char *value) {
	u32 length = 0;
	while ( value[ length ] ) length ++;
	result_size = length;
	return (u32) value;
}

__attribute__((export_name("init"))) u32 init(u32 input, u32 length) {
	(void) input;
	(void) length;
	return output( day );
}

__attribute__((export_name("step"))) u32 step(u32 input, u32 length) {
	const unsigned char *bytes = (const unsigned char *) input;
	const char key[] = "\"timeOfDay\":";
	u32 hourTenths = 0;
	for ( u32 i = 0; i + sizeof( key ) - 1 < length; i ++ ) {
		u32 j = 0;
		while ( j < sizeof( key ) - 1 && bytes[ i + j ] == (unsigned char) key[ j ] ) j ++;
		if ( j != sizeof( key ) - 1 ) continue;
		u32 k = i + j;
		while ( k < length && bytes[ k ] >= '0' && bytes[ k ] <= '9' ) hourTenths = hourTenths * 10 + ( bytes[ k ++ ] - '0' );
		hourTenths *= 10;
		if ( k < length && bytes[ k ] == '.' ) {
			k ++;
			if ( k < length && bytes[ k ] >= '0' && bytes[ k ] <= '9' ) hourTenths += bytes[ k ] - '0';
		}
		break;
	}
	if ( ( hourTenths >= 50 && hourTenths <= 80 ) || ( hourTenths >= 170 && hourTenths <= 200 ) ) return output( dawn );
	if ( hourTenths < 50 || hourTenths >= 220 ) return output( night );
	return output( day );
}

__attribute__((export_name("output_len"))) u32 output_len(void) {
	const u32 length = result_size;
	heap_cursor = (u32) &__heap_base;
	return length;
}
