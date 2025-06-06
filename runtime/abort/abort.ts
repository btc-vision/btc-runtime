import { env_exit } from '../env/global';

export function revertOnError(message: string, fileName: string, line: u32, column: u32): void {
    const selector = 0x63739d5c; // Error(string)

    const revertMessage = `${message} at ${fileName}:${line}:${column}`;
    const revertMessageBytes = Uint8Array.wrap(String.UTF8.encode(revertMessage));

    const arrayBuffer = new ArrayBuffer(4 + revertMessageBytes.length + 4);
    const writer = new DataView(arrayBuffer);

    writer.setUint32(0, selector, false);
    writer.setUint32(4, revertMessageBytes.length, false);

    for (let i = 0; i < revertMessageBytes.length; i++) {
        writer.setUint8(8 + i, revertMessageBytes[i]);
    }

    env_exit(1, arrayBuffer, arrayBuffer.byteLength);
}
