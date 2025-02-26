import { BytesWriter } from '../buffer/BytesWriter';
import { env_revert } from '../env/global';

export function revertOnError(message: string, fileName: string, line: u32, column: u32): void {
    const selector = 0x63739d5c; // Error(string)
    const revertMessage = `${message} at ${fileName}:${line}:${column}`;

    const writer = new BytesWriter(4 + revertMessage.length + 2);
    writer.writeSelector(selector);
    writer.writeStringWithLength(revertMessage);

    const buffer = writer.getBuffer().buffer;
    env_revert(buffer, buffer.byteLength);
}
