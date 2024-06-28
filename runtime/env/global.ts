// @ts-ignore
@external('env', 'load')
export declare function loadPointer(data: Uint8Array): Uint8Array;

// @ts-ignore
@external('env', 'store')
export declare function storePointer(data: Uint8Array): Uint8Array;

// @ts-ignore
@external('env', 'deploy')
export declare function deploy(data: Uint8Array): Uint8Array;

// @ts-ignore
@external('env', 'deployFromAddress')
export declare function deployFromAddress(data: Uint8Array): Uint8Array;

// @ts-ignore
@external('env', 'call')
export declare function callContract(data: Uint8Array): Uint8Array;
