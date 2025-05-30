import { DataView } from 'dataview';
import { ArrayBuffer } from 'arraybuffer';
import { env_exit } from '../env/global';

export function revertOnError(message: string, fileName: string, line: u32, column: u32): void {
    const selector = 0x63739d5c; // Error(string)

    const revertMessage = `${message} at ${fileName}:${line}:${column}`;

    const length = revertMessage.length;

    const arrayBuffer = new ArrayBuffer(4 + length + 4);
    const writer = new DataView(arrayBuffer);

    writer.setUint32(0, selector, false);
    writer.setUint32(4, length, false);

    for (let i = 0; i < length; i++) {
        writer.setUint8(8 + i, <u8>revertMessage.charCodeAt(i));
    }

    env_exit(1, arrayBuffer, arrayBuffer.byteLength);
}
