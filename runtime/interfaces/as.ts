export interface ArrayLike<T> {
    length: i32;

    [key: number]: T;
}
