import { BaseStoredString } from './BaseStoredString';

/**
 * @class AdvancedStoredString
 * @description
 * Stores a string with a directly provided subPointer.
 * Maximum length: 256 bytes (configurable)
 */
@final
export class AdvancedStoredString extends BaseStoredString {
    constructor(pointer: u16, subPointer: Uint8Array, maxLength: u32 = 256) {
        super(pointer, subPointer, maxLength);
    }

    protected getClassName(): string {
        return 'AdvancedStoredString';
    }
}
