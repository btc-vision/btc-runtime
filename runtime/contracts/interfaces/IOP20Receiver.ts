import { BytesWriter } from '../../buffer/BytesWriter';
import { Calldata } from '../../types';

export interface IOP20Receiver {
    onOP20Received(callData: Calldata): BytesWriter;
}
