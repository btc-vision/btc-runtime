import { Blockchain } from '../../env';

export class StorageLayout {
    public next(): u16 {
        return Blockchain.nextPointer;
    }
}
