import { Map } from '../generic/Map';
import { MemorySlotPointer } from '../memory/MemorySlotPointer';
import { MemorySlotData } from '../memory/MemorySlot';
import { u256 } from '@btc-vision/as-bignum/assembly';
import { BytesReader } from '../buffer/BytesReader';

export type PointerStorage = Map<MemorySlotPointer, MemorySlotData<u256>>;
export type Calldata = NonNullable<BytesReader>;
