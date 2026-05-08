/**
 * Enumeration of signature methods used in the consensus environment.
 */
export enum SignaturesMethods {
    ECDSA = 0x00,
    Schnorr = 0x01,
    MLDSA = 0x02,
}

/**
 * ECDSA sub-type discriminant stored at byte 1 of the host buffer when
 * byte 0 is SignaturesMethods.ECDSA (0x00).
 *
 * Ethereum: ecrecover model, 65-byte signature (r32 || s32 || v1).
 * Bitcoin:  direct verify model, 64-byte compact signature (r32 || s32).
 */
export const enum ECDSASubType {
    Ethereum = 0,
    Bitcoin = 1,
}

/**
 * ECDSA key format discriminant stored at byte 2 of the host buffer when
 * byte 0 is SignaturesMethods.ECDSA (0x00).
 *
 * Compressed and uncompressed formats are standard SEC1 encodings with 0x02/0x03 and 0x04 prefixes, respectively.
 * Hybrid format uses 0x06/0x07 prefixes to indicate the parity of the y-coordinate, but is rewritten to 0x04 on the host for compatibility.
 * Raw format is a non-standard 64-byte encoding that concatenates the x and y coordinates without any prefix.
 *
 * The choice of key format affects how the public key is represented and processed in cryptographic operations, with compressed keys being more space-efficient and uncompressed keys providing a straightforward representation of the full public key.
 * The hybrid format is less common and may be used in specific contexts where both the x-coordinate and the parity of the y-coordinate are needed, while the raw format is typically used in scenarios where a compact representation of the public key is desired without the overhead of prefix bytes.
 */
export enum ECDSAKeyFormat {
    Compressed = 0x00, // 33-byte SEC1 (0x02/0x03 prefix)
    Uncompressed = 0x01, // 65-byte SEC1 (0x04 prefix)
    Hybrid = 0x02, // 65-byte SEC1 (0x06/0x07 prefix, rewritten to 0x04 on host)
    Raw = 0x03, // 64-byte X||Y (no prefix)
}
