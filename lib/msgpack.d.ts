export declare const msgpack: {
    encode: (data: any) => Uint8Array;
    decode: (array: number[] | Uint8Array) => any;
};
export declare class MsgpackEncoder {
    private floatBuffer;
    private floatView;
    private array;
    private length;
    encode(data: any): Uint8Array;
    private append;
    private appendNull;
    private appendBoolean;
    private appendNumber;
    private appendString;
    private appendArray;
    private appendBinArray;
    private appendObject;
    private appendDate;
    private appendByte;
    private appendBytes;
    private appendInt64;
    private encodeUtf8;
}
export declare class MsgpackDecoder {
    private array;
    private data;
    private pos;
    decode(array: Uint8Array | number[]): any;
    private read;
    private readInt;
    private readUInt;
    private readFloat;
    private readBin;
    private readMap;
    private readArray;
    private readStr;
    private readExt;
    private readExtDate;
    private decodeUtf8;
}
