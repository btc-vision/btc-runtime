import { env_revert } from '../env/global';
import { DataView } from 'dataview';
import { ArrayBuffer } from 'arraybuffer';

export function revertOnError(message: string, fileName: string, line: u32, column: u32): void {
    const selector = 0x63739d5c; // Error(string)
    const revertMessage = `${message} at ${fileName}:${line}:${column}`;

    const arrayBuffer = new ArrayBuffer(4 + revertMessage.length + 2);
    const writer = new DataView(arrayBuffer);

    writer.setUint32(0, selector, false);
    writer.setUint16(4, revertMessage.length, false);

    for (let i = 0; i < revertMessage.length; i++) {
        writer.setUint8(6 + i, <u8>revertMessage.charCodeAt(i));
    }

    env_revert(arrayBuffer, arrayBuffer.byteLength);
}