import { Map } from '../generic/Map';
import { BytesReader } from '../buffer/BytesReader';

export type PointerStorage = Map<Uint8Array, Uint8Array>;
export type Calldata = NonNullable<BytesReader>;
