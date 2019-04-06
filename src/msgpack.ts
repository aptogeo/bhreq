// Messagepack decode/encoder inspired @ygeo/msgpack
/*
Copyright © 2019, Yves Goergen, https://unclassified.software

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the “Software”), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

type basictype = undefined | null | boolean | number | string | Date;

type bytestype = number[] | Uint8Array | Uint8ClampedArray;

type basicarraytype = basictype[] | bytestype | Int8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array;

type arraytype = basicarraytype | objecttype[] | basictype[] | any[];

type objecttype = { [key: string]: any; };

const pow32 = 0x100000000;   // 2^32

export const msgpack = {
	// Encode a value to a MessagePack byte array.
	//
	// data: The value to serialize. This can be a scalar, array or object.
	encode: function (data: any): Uint8Array {
		return new MsgpackEncoder().encode(data);
	},

	// Decode a value to a MessagePack byte array.
	//
	// data: The value to serialize.
	decode: function (array: Uint8Array | number[]): any {
		return new MsgpackDecoder().decode(array);
	}
};

export class MsgpackEncoder {
	private floatBuffer: ArrayBuffer;
	private floatView: DataView;
	private array: Uint8Array;
	private length: number;

	public encode(data: any): Uint8Array {
		this.array = new Uint8Array(128);
		this.length = 0;
		this.append(data);
		return this.array;
	}

	private append(data: any) {
		switch (typeof data) {
			case "boolean":
				this.appendBoolean(data);
				break;
			case "number":
				this.appendNumber(data);
				break;
			case "string":
				this.appendString(data);
				break;
			default:
				if (data == null)
					this.appendNull(null);
				else if (data instanceof Date)
					this.appendDate(data);
				else if (data instanceof Uint8Array || data instanceof Uint8ClampedArray)
					this.appendBinArray(data);
				else if (data instanceof Int8Array || data instanceof Int16Array || data instanceof Uint16Array ||
					data instanceof Int32Array || data instanceof Uint32Array ||
					data instanceof Float32Array || data instanceof Float64Array)
					this.appendArray(data);
				else if (Array.isArray(data))
					this.appendArray(data);
				else
					this.appendObject(data);
				break;
		}
	}

	private appendNull(data: undefined | null) {
		this.appendByte(0xc0);
	}

	private appendBoolean(data: boolean) {
		this.appendByte(data ? 0xc3 : 0xc2);
	}

	private appendNumber(data: number) {
		if (isFinite(data) && Math.floor(data) === data) {
			// Integer
			if (data >= 0 && data <= 0x7f) {
				this.appendByte(data);
			}
			else if (data < 0 && data >= -0x20) {
				this.appendByte(data);
			}
			else if (data > 0 && data <= 0xff) {   // uint8
				this.appendBytes([0xcc, data]);
			}
			else if (data >= -0x80 && data <= 0x7f) {   // int8
				this.appendBytes([0xd0, data]);
			}
			else if (data > 0 && data <= 0xffff) {   // uint16
				this.appendBytes([0xcd, data >>> 8, data]);
			}
			else if (data >= -0x8000 && data <= 0x7fff) {   // int16
				this.appendBytes([0xd1, data >>> 8, data]);
			}
			else if (data > 0 && data <= 0xffffffff) {   // uint32
				this.appendBytes([0xce, data >>> 24, data >>> 16, data >>> 8, data]);
			}
			else if (data >= -0x80000000 && data <= 0x7fffffff) {   // int32
				this.appendBytes([0xd2, data >>> 24, data >>> 16, data >>> 8, data]);
			}
			else if (data > 0 && data <= 0xffffffffffffffff) {   // uint64
				// Split 64 bit number into two 32 bit numbers because JavaScript only regards
				// 32 bits for bitwise operations.
				let hi = data / pow32;
				let lo = data % pow32;
				this.appendBytes([0xd3, hi >>> 24, hi >>> 16, hi >>> 8, hi, lo >>> 24, lo >>> 16, lo >>> 8, lo]);
			}
			else if (data >= -0x8000000000000000 && data <= 0x7fffffffffffffff) {   // int64
				this.appendByte(0xd3);
				this.appendInt64(data);
			}
			else if (data < 0) {   // below int64
				this.appendBytes([0xd3, 0x80, 0, 0, 0, 0, 0, 0, 0]);
			}
			else {   // above uint64
				this.appendBytes([0xcf, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
			}
		}
		else {
			// Float
			if (!this.floatView) {
				this.floatBuffer = new ArrayBuffer(8);
				this.floatView = new DataView(this.floatBuffer);
			}
			this.floatView.setFloat64(0, data);
			this.appendByte(0xcb);
			this.appendBytes(new Uint8Array(this.floatBuffer));
		}
	}

	private appendString(data: string) {
		let bytes = this.encodeUtf8(data);
		let length = bytes.length;

		if (length <= 0x1f) {
			this.appendByte(0xa0 + length);
		} else if (length <= 0xff) {
			this.appendBytes([0xd9, length]);
		} else if (length <= 0xffff) {
			this.appendBytes([0xda, length >>> 8, length]);
		} else {
			this.appendBytes([0xdb, length >>> 24, length >>> 16, length >>> 8, length]);
		}

		this.appendBytes(bytes);
	}

	private appendArray(data: arraytype) {
		let length = data.length;

		if (length <= 0xf)
			this.appendByte(0x90 + length);
		else if (length <= 0xffff)
			this.appendBytes([0xdc, length >>> 8, length]);
		else
			this.appendBytes([0xdd, length >>> 24, length >>> 16, length >>> 8, length]);

		for (let index = 0; index < length; index++) {
			this.append(data[index]);
		}
	}

	private appendBinArray(data: bytestype) {
		const length = data.length;

		if (length <= 0xf) {
			this.appendBytes([0xc4, length]);
		} else if (length <= 0xffff) {
			this.appendBytes([0xc5, length >>> 8, length]);
		} else {
			this.appendBytes([0xc6, length >>> 24, length >>> 16, length >>> 8, length]);
		}

		this.appendBytes(data);
	}

	private appendObject(data: { [key: string]: any; }) {
		let length = 0;
		for (let key in data) {
			length++;
		}

		if (length <= 0xf) {
			this.appendByte(0x80 + length);
		} else if (length <= 0xffff) {
			this.appendBytes([0xde, length >>> 8, length]);
		} else {
			this.appendBytes([0xdf, length >>> 24, length >>> 16, length >>> 8, length]);
		}

		for (let key in data) {
			this.append(key);
			this.append(data[key]);
		}
	}

	private appendDate(data: Date) {
		let sec = data.getTime() / 1000;
		if (data.getMilliseconds() === 0 && sec >= 0 && sec < 0x100000000) {   // 32 bit seconds
			this.appendBytes([0xd6, 0xff, sec >>> 24, sec >>> 16, sec >>> 8, sec]);
		}
		else if (sec >= 0 && sec < 0x400000000) {   // 30 bit nanoseconds, 34 bit seconds
			let ns = data.getMilliseconds() * 1000000;
			this.appendBytes([0xd7, 0xff, ns >>> 22, ns >>> 14, ns >>> 6, ((ns << 2) >>> 0) | (sec / pow32), sec >>> 24, sec >>> 16, sec >>> 8, sec]);
		}
		else {   // 32 bit nanoseconds, 64 bit seconds, negative values allowed
			let ns = data.getMilliseconds() * 1000000;
			this.appendBytes([0xc7, 12, 0xff, ns >>> 24, ns >>> 16, ns >>> 8, ns]);
			this.appendInt64(sec);
		}
	}

	private appendByte(byte: number) {
		if (this.array.length < this.length + 1) {
			let newLength = this.array.length * 2;
			while (newLength < this.length + 1) {
				newLength *= 2;
			}
			let newArray = new Uint8Array(newLength);
			newArray.set(this.array);
			this.array = newArray;
		}
		this.array[this.length] = byte;
		this.length++;
	}

	private appendBytes(bytes: bytestype) {
		if (this.array.length < this.length + bytes.length) {
			let newLength = this.array.length * 2;
			while (newLength < this.length + bytes.length) {
				newLength *= 2;
			}
			let newArray = new Uint8Array(newLength);
			newArray.set(this.array);
			this.array = newArray;
		}
		this.array.set(bytes, this.length);
		this.length += bytes.length;
	}

	private appendInt64(value: number) {
		// Split 64 bit number into two 32 bit numbers because JavaScript only regards 32 bits for
		// bitwise operations.
		let hi, lo;
		if (value >= 0) {
			// Same as uint64
			hi = value / pow32;
			lo = value % pow32;
		}
		else {
			// Split absolute value to high and low, then NOT and ADD(1) to restore negativity
			value++;
			hi = Math.abs(value) / pow32;
			lo = Math.abs(value) % pow32;
			hi = ~hi;
			lo = ~lo;
		}
		this.appendBytes([hi >>> 24, hi >>> 16, hi >>> 8, hi, lo >>> 24, lo >>> 16, lo >>> 8, lo]);
	}

	// Encodes a string to UTF-8 bytes.
	private encodeUtf8(str: string): Uint8Array {
		// Prevent excessive array allocation and slicing for all 7-bit characters
		let ascii = true;
		const length = str.length;
		for (let x = 0; x < length; x++) {
			if (str.charCodeAt(x) > 127) {
				ascii = false;
				break;
			}
		}
		// Based on: https://gist.github.com/pascaldekloe/62546103a1576803dade9269ccf76330
		let i = 0
		const bytes = new Uint8Array(str.length * (ascii ? 1 : 4));
		for (let ci = 0; ci !== length; ci++) {
			let c = str.charCodeAt(ci);
			if (c < 128) {
				bytes[i++] = c;
				continue;
			}
			if (c < 2048) {
				bytes[i++] = c >> 6 | 192;
			}
			else {
				if (c > 0xd7ff && c < 0xdc00) {
					if (++ci >= length)  {
						throw new Error("UTF-8 encode: incomplete surrogate pair");
					}
					let c2 = str.charCodeAt(ci);
					if (c2 < 0xdc00 || c2 > 0xdfff) {
						throw new Error("UTF-8 encode: second surrogate character 0x" + c2.toString(16) + " at index " + ci + " out of range");
					}
					c = 0x10000 + ((c & 0x03ff) << 10) + (c2 & 0x03ff);
					bytes[i++] = c >> 18 | 240;
					bytes[i++] = c >> 12 & 63 | 128;
				} else {
					bytes[i++] = c >> 12 | 224;
				}
				bytes[i++] = c >> 6 & 63 | 128;
			}
			bytes[i++] = c & 63 | 128;
		}
		return ascii ? bytes : bytes.subarray(0, i);
	}
}

export class MsgpackDecoder {
	private array: Uint8Array;
	private data: any;
	private pos: number;

	public decode(array: Uint8Array | number[]): any {
		this.array = (array instanceof Uint8Array) ? array : new Uint8Array(array);
		this.pos = 0;
		this.data = this.read();
		return this.data;
	}

	private read(): any {
		const byte = this.array[this.pos++];
		if (byte >= 0x00 && byte <= 0x7f) return byte;   // positive fixint
		if (byte >= 0x80 && byte <= 0x8f) return this.readMap(byte - 0x80);   // fixmap
		if (byte >= 0x90 && byte <= 0x9f) return this.readArray(byte - 0x90);   // fixarray
		if (byte >= 0xa0 && byte <= 0xbf) return this.readStr(byte - 0xa0);   // fixstr
		if (byte === 0xc0) return null;   // nil
		if (byte === 0xc1) throw new Error("Invalid byte code 0xc1 found.");   // never used
		if (byte === 0xc2) return false;   // false
		if (byte === 0xc3) return true;   // true
		if (byte === 0xc4) return this.readBin(-1, 1);   // bin 8
		if (byte === 0xc5) return this.readBin(-1, 2);   // bin 16
		if (byte === 0xc6) return this.readBin(-1, 4);   // bin 32
		if (byte === 0xc7) return this.readExt(-1, 1);   // ext 8
		if (byte === 0xc8) return this.readExt(-1, 2);   // ext 16
		if (byte === 0xc9) return this.readExt(-1, 4);   // ext 32
		if (byte === 0xca) return this.readFloat(4);   // float 32
		if (byte === 0xcb) return this.readFloat(8);   // float 64
		if (byte === 0xcc) return this.readUInt(1);   // uint 8
		if (byte === 0xcd) return this.readUInt(2);   // uint 16
		if (byte === 0xce) return this.readUInt(4);   // uint 32
		if (byte === 0xcf) return this.readUInt(8);   // uint 64
		if (byte === 0xd0) return this.readInt(1);   // int 8
		if (byte === 0xd1) return this.readInt(2);   // int 16
		if (byte === 0xd2) return this.readInt(4);   // int 32
		if (byte === 0xd3) return this.readInt(8);   // int 64
		if (byte === 0xd4) return this.readExt(1);   // fixext 1
		if (byte === 0xd5) return this.readExt(2);   // fixext 2
		if (byte === 0xd6) return this.readExt(4);   // fixext 4
		if (byte === 0xd7) return this.readExt(8);   // fixext 8
		if (byte === 0xd8) return this.readExt(16);   // fixext 16
		if (byte === 0xd9) return this.readStr(-1, 1);   // str 8
		if (byte === 0xda) return this.readStr(-1, 2);   // str 16
		if (byte === 0xdb) return this.readStr(-1, 4);   // str 32
		if (byte === 0xdc) return this.readArray(-1, 2);   // array 16
		if (byte === 0xdd) return this.readArray(-1, 4);   // array 32
		if (byte === 0xde) return this.readMap(-1, 2);   // map 16
		if (byte === 0xdf) return this.readMap(-1, 4);   // map 32
		if (byte >= 0xe0 && byte <= 0xff) return byte - 256;   // negative fixint
		throw new Error("Invalid byte value " + byte + " in the MessagePack binary data : Expecting a range of 0 to 255. This is not a byte array.");
	}

	private readInt(size: number) {
		let value = 0;
		let first = true;
		while (size-- > 0) {
			if (first) {
				let byte = this.array[this.pos++];
				value += byte & 0x7f;
				if (byte & 0x80) {
					value -= 0x80;   // Treat most-significant bit as -2^i instead of 2^i
				}
				first = false;
			}
			else {
				value *= 256;
				value += this.array[this.pos++];
			}
		}
		return value;
	}

	private readUInt(size: number) {
		let value = 0;
		while (size-- > 0) {
			value *= 256;
			value += this.array[this.pos++];
		}
		return value;
	}

	private readFloat(size: number) {
		let view = new DataView(this.array.buffer, this.pos, size);
		this.pos += size;
		if (size === 4)
			return view.getFloat32(0, false);
		if (size === 8)
			return view.getFloat64(0, false);
	}

	private readBin(size: number, lengthSize: number = 0) {
		if (size < 0) size = this.readUInt(lengthSize);
		let data = this.array.subarray(this.pos, this.pos + size);
		this.pos += size;
		return data;
	}

	private readMap(size: number, lengthSize: number = 0) {
		if (size < 0) size = this.readUInt(lengthSize);
		let data: objecttype = {};
		while (size-- > 0) {
			let key = this.read();
			data[key] = this.read();
		}
		return data;
	}

	private readArray(size: number, lengthSize: number = 0) {
		if (size < 0) size = this.readUInt(lengthSize);
		let data = [];
		while (size-- > 0) {
			data.push(this.read());
		}
		return data;
	}

	private readStr(size: number, lengthSize: number = 0) {
		if (size < 0) size = this.readUInt(lengthSize);
		let start = this.pos;
		this.pos += size;
		return this.decodeUtf8(this.array, start, size);
	}

	private readExt(size: number, lengthSize: number = 0) {
		if (size < 0) size = this.readUInt(lengthSize);
		let type = this.readUInt(1);
		let data = this.readBin(size);
		switch (type) {
			case 255:
				return this.readExtDate(data);
		}
		return { type: type, data: data };
	}

	private readExtDate(data: Uint8Array) {
		if (data.length === 4) {
			let sec = ((data[0] << 24) >>> 0) +
				((data[1] << 16) >>> 0) +
				((data[2] << 8) >>> 0) +
				data[3];
			return new Date(sec * 1000);
		}
		if (data.length === 8) {
			let ns = ((data[0] << 22) >>> 0) +
				((data[1] << 14) >>> 0) +
				((data[2] << 6) >>> 0) +
				(data[3] >>> 2);
			let sec = ((data[3] & 0x3) * pow32) +
				((data[4] << 24) >>> 0) +
				((data[5] << 16) >>> 0) +
				((data[6] << 8) >>> 0) +
				data[7];
			return new Date(sec * 1000 + ns / 1000000);
		}
		if (data.length === 12) {
			let ns = ((data[0] << 24) >>> 0) +
				((data[1] << 16) >>> 0) +
				((data[2] << 8) >>> 0) +
				data[3];
			this.pos -= 8;
			let sec = this.readInt(8);
			return new Date(sec * 1000 + ns / 1000000);
		}
		throw new Error("Invalid data length for a date value.");
	}


	// Decodes a string from UTF-8 bytes.
	private decodeUtf8(bytes: Uint8Array, start: number, length: number) {
		// Based on: https://gist.github.com/pascaldekloe/62546103a1576803dade9269ccf76330
		let i = start, str = "";
		length += start;
		while (i < length) {
			let c = bytes[i++];
			if (c > 127) {
				if (c > 191 && c < 224) {
					if (i >= length)
						throw new Error("UTF-8 decode: incomplete 2-byte sequence");
					c = (c & 31) << 6 | bytes[i++] & 63;
				}
				else if (c > 223 && c < 240) {
					if (i + 1 >= length)
						throw new Error("UTF-8 decode: incomplete 3-byte sequence");
					c = (c & 15) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
				}
				else if (c > 239 && c < 248) {
					if (i + 2 >= length)
						throw new Error("UTF-8 decode: incomplete 4-byte sequence");
					c = (c & 7) << 18 | (bytes[i++] & 63) << 12 | (bytes[i++] & 63) << 6 | bytes[i++] & 63;
				}
				else throw new Error("UTF-8 decode: unknown multibyte start 0x" + c.toString(16) + " at index " + (i - 1));
			}
			if (c <= 0xffff) str += String.fromCharCode(c);
			else if (c <= 0x10ffff) {
				c -= 0x10000;
				str += String.fromCharCode(c >> 10 | 0xd800)
				str += String.fromCharCode(c & 0x3FF | 0xdc00)
			}
			else throw new Error("UTF-8 decode: code point 0x" + c.toString(16) + " exceeds UTF-16 reach");
		}
		return str;
	}
}
