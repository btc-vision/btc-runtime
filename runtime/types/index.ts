import { Map } from '../generic/Map';
import { MemorySlotPointer } from '../memory/MemorySlotPointer';
import { MemorySlotData } from '../memory/MemorySlot';
import { u256 } from 'as-bignum/assembly';
import { Address } from './Address';


export type PointerStorage = Map<MemorySlotPointer, MemorySlotData<u256>>;
export type BlockchainStorage = Map<Address, PointerStorage>;
