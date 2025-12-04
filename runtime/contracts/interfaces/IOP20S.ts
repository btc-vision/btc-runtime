import { Calldata } from '../../types';
import { BytesWriter } from '../../buffer/BytesWriter';

export interface IOP20S {
    pegRate(calldata: Calldata): BytesWriter;
    pegAuthority(calldata: Calldata): BytesWriter;
    pegUpdatedAt(calldata: Calldata): BytesWriter;
}
