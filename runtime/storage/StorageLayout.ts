export class StorageLayout {
  public pointer: u16;
  next(): u16 {
    const result = this.pointer;
    this.pointer++;
    return result;
  }
}
