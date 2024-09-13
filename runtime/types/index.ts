import { u256 } from 'as-bignum/assembly';
import { Map } from '../generic/Map';
import { MemorySlotData } from '../memory/MemorySlot';
import { MemorySlotPointer } from '../memory/MemorySlotPointer';
import { Address } from './Address';

export type PointerStorage = Map<MemorySlotPointer, MemorySlotData<u256>>;
export type BlockchainStorage = Map<Address, PointerStorage>;
