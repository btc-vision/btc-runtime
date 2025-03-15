export interface ICodec<T> {
    /**
     * Encode in-memory `value` into a buffer that will be stored in blockchain storage.
     * Possibly a single 32-byte chunk or a pointer if more is needed.
     */
    encode(value: T): Uint8Array;

    /**
     * Decode a buffer from storage into an in-memory `T`.
     */
    decode(buffer: Uint8Array): T;
}
