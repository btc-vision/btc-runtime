type aisize = i32;

/**
 * (best-effort) Constant-time hexadecimal encoding
 * @param bin Binary data
 * @returns Hex-encoded representation
 */
export function bin2hex(bin: Uint8Array): string {
    let bin_len = bin.length;
    let hex = "";
    for (let i = 0; i < bin_len; i++) {
        let bin_i = bin[i] as u32;
        let c = bin_i & 0xf;
        let b = bin_i >> 4;
        let x: u32 = ((87 + c + (((c - 10) >> 8) & ~38)) << 8) |
            (87 + b + (((b - 10) >> 8) & ~38));
        hex += String.fromCharCode(x as u8);
        x >>= 8;
        hex += String.fromCharCode(x as u8);
    }
    return hex;
}

/**
* (best-effort) Constant-time hexadecimal decoding
* @param hex Hex-encoded data
* @returns Raw binary representation
*/
function hex2bin(hex: string): Uint8Array | null {
    let hex_len = hex.length;
    if ((hex_len & 1) !== 0) {
        return null;
    }
    let bin = new Uint8Array(<aisize>(hex_len / 2));
    let c_acc = 0;
    let bin_pos = 0;
    let state = false;
    for (let hex_pos = 0; hex_pos < hex_len; hex_pos++) {
        let c = hex.charCodeAt(hex_pos) as u32;
        let c_num = c ^ 48;
        let c_num0 = (c_num - 10) >> 8;
        let c_alpha = (c & ~32) - 55;
        let c_alpha0 = ((c_alpha - 10) ^ (c_alpha - 16)) >> 8;
        if ((c_num0 | c_alpha0) === 0) {
            return null;
        }
        let c_val = ((c_num0 & c_num) | (c_alpha0 & c_alpha)) as u8;
        if (state === false) {
            c_acc = c_val << 4;
        } else {
            bin[bin_pos++] = c_acc | c_val;
        }
        state = !state;
    }
    return bin;
}


/**
* (best-effort) Constant-time verification that x == y
* @param x array 1
* @param y array 2
* @returns true if both arrays contain the same data
*/
export function verify(x: Uint8Array, y: Uint8Array): bool {
    let d: u8 = 0;

    if (x.length != y.length) {
        return false;
    }
    for (let i = 0; i < x.length; ++i) {
        d |= x[i] ^ y[i];
    }
    return d === 0;
}
