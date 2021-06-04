(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.bhreq = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Engine = exports.send = void 0;
var msgpack_1 = require("./msgpack");
var defaultTimeout = 10000;
var defaultMethod = 'GET';
var contentTypeHeaderName = 'Content-Type';
var timeoutError = {
    status: 408,
    statusText: 'Request timeout'
};
var indeterminateResponseError = {
    status: 409,
    statusText: 'Unable to determine the response'
};
var unparsableResponseError = {
    status: 409,
    statusText: 'Unable to parse the response'
};
var unopenableRequestError = {
    status: 409,
    statusText: 'Unable to open the request'
};
var unsendableRequestError = {
    status: 409,
    statusText: 'Unable to send the request'
};
function deserializeBody(data, contentType) {
    if (typeof data === 'string') {
        if (/[+-/]json($|[+-;])/i.test(contentType)) {
            // is JSON
            try {
                return JSON.parse(data);
            }
            catch (err) {
                console.error("Error to parse JSON " + err);
                return data;
            }
        }
        else if (/[+-/]form($|[+-;])/i.test(contentType)) {
            // is Form
            var keyValues = data.split('&');
            var deserializedData = {};
            for (var _i = 0, keyValues_1 = keyValues; _i < keyValues_1.length; _i++) {
                var keyValue = keyValues_1[_i];
                var parts = keyValue.split('=');
                if (parts.length === 2) {
                    var key = decodeURIComponent(parts[0]);
                    var value = decodeURIComponent(parts[1]);
                    deserializedData[key] = value;
                }
            }
            return deserializedData;
        }
        else {
            return data;
        }
    }
    else if (/[+-/](msgpack|messagepack)($|[+-;])/i.test(contentType)) {
        // is Messsage pack
        try {
            return msgpack_1.msgpack.decode(new Uint8Array(data));
        }
        catch (err) {
            console.error("Error to parse Msgpack " + err);
            return data;
        }
    }
    else {
        return data;
    }
}
function serializeBody(data, contentType) {
    var serializedData = data;
    if (typeof data === 'object') {
        if (/[+-/]json($|[+-;])/i.test(contentType)) {
            // is JSON
            serializedData = JSON.stringify(data);
        }
        else if (/[+-/]form($|[+-;])/i.test(contentType)) {
            // is Form
            var keyValues = [];
            for (var key in data) {
                if (data.hasOwnProperty(key)) {
                    keyValues.push(encodeURIComponent(key) + "=" + encodeURIComponent(data[key]));
                }
            }
            serializedData = keyValues.join('&');
        }
        else if (/[+-/]msgpack|messagepack($|[+-;])/i.test(contentType)) {
            // is Messsage pack
            serializedData = msgpack_1.msgpack.encode(data);
        }
    }
    return serializedData;
}
function serializeParams(params) {
    var keyValues = [];
    for (var key in params) {
        keyValues.push(encodeURIComponent(key) + "=" + encodeURIComponent(params[key]));
    }
    return keyValues.join('&');
}
function deserializeHeaders(data) {
    var headers = {};
    var lines = data.split(/\r?\n/);
    for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
        var line = lines_1[_i];
        var parts = line.split(':');
        if (parts.length === 2) {
            headers[parts[0].trim()] = parts[1].trim();
        }
    }
    return headers;
}
/**
 * Send request.
 *
 * @param {IRequest} request
 * @returns {Promise<IResponse>}
 */
function send(request) {
    var normUrl = request.url.replace(/([^:])\/\//g, '$1/').replace(/\/\.\//g, '/');
    if (request.params) {
        if (normUrl.indexOf('?') > 0) {
            normUrl += '&' + serializeParams(request.params);
        }
        else {
            normUrl += '?' + serializeParams(request.params);
        }
    }
    return new Promise(function (resolve, reject) {
        var client = new XMLHttpRequest();
        var timer = setTimeout(function () {
            timer = null;
            try {
                client.abort();
            }
            catch (err) {
                // Nothing
            }
            reject(timeoutError);
        }, request && request.timeout ? request.timeout : defaultTimeout);
        client.onerror = function (err) {
            clearTimeout(timer);
            timer = null;
            reject(indeterminateResponseError);
        };
        client.onreadystatechange = function () {
            if (client.readyState >= 2 && timer) {
                clearTimeout(timer);
                timer = null;
            }
            if (client.readyState !== 4) {
                return;
            }
            var status;
            var statusText;
            try {
                // Normalize IE's statusText to "No Content" instead of "Unknown".
                status = client.status === 1223 ? 204 : client.status;
                // Normalize IE's statusText to "No Content" instead of "Unknown".
                statusText = client.status === 1223 ? 'No Content' : client.statusText;
            }
            catch (err) {
                console.error(indeterminateResponseError.statusText + ": " + err);
                reject(indeterminateResponseError);
                return;
            }
            if (status < 200 || status >= 300) {
                reject({
                    status: status,
                    statusText: statusText,
                    text: client.response
                });
                return;
            }
            try {
                var raw = client.response;
                var responseType = client.responseType;
                // ResponseText is accessible only if responseType is '' or 'text' and on older browsers
                var text = ((request.method !== 'HEAD' && (responseType === '' || responseType === 'text')) ||
                    (typeof responseType === 'undefined'))
                    ? client.responseText
                    : null;
                var contentType = client.getResponseHeader(contentTypeHeaderName);
                resolve({
                    responseType: responseType,
                    text: text,
                    body: deserializeBody(text ? text : raw, contentType),
                    status: status,
                    statusText: statusText,
                    contentType: contentType,
                    headers: deserializeHeaders(client.getAllResponseHeaders())
                });
            }
            catch (err) {
                console.error(unparsableResponseError.statusText + ": " + err);
                reject(unparsableResponseError);
            }
        };
        try {
            client.open(request.method ? request.method : defaultMethod, normUrl);
        }
        catch (err) {
            console.error(unopenableRequestError.statusText + ": " + err);
            reject(unopenableRequestError);
            return;
        }
        try {
            if (request.headers) {
                for (var key in request.headers) {
                    if (key.toLowerCase() === contentTypeHeaderName.toLowerCase()) {
                        request.contentType = request.headers[key];
                    }
                    else {
                        client.setRequestHeader(key, request.headers[key]);
                    }
                }
            }
            if (request.contentType) {
                client.setRequestHeader(contentTypeHeaderName, request.contentType);
            }
            if (request.responseType) {
                client.responseType = request.responseType;
            }
            if (request.body) {
                client.send(serializeBody(request.body, request.contentType));
            }
            else {
                client.send();
            }
        }
        catch (err) {
            console.error(unsendableRequestError.statusText + ": " + err);
            reject(unsendableRequestError);
        }
    });
}
exports.send = send;
var Engine = /** @class */ (function () {
    function Engine() {
        var _this = this;
        this.treatResponse = function (rawResponse) {
            var response = rawResponse;
            _this.afterReceivedInterceptors.forEach(function (interceptor) {
                response = interceptor(response);
            });
            return response;
        };
        this.beforeSendInterceptors = [];
        this.afterReceivedInterceptors = [];
    }
    Engine.getInstance = function (name) {
        if (name === void 0) { name = 'default'; }
        if (!this.instances) {
            this.instances = {};
        }
        if (!this.instances[name]) {
            this.instances[name] = new Engine();
        }
        return this.instances[name];
    };
    Engine.prototype.send = function (rawRequest) {
        var request = rawRequest;
        this.beforeSendInterceptors.forEach(function (interceptor) {
            request = interceptor(request);
        });
        return send(request).then(this.treatResponse);
    };
    return Engine;
}());
exports.Engine = Engine;

},{"./msgpack":3}],2:[function(require,module,exports){
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./bhreq"), exports);
__exportStar(require("./msgpack"), exports);

},{"./bhreq":1,"./msgpack":3}],3:[function(require,module,exports){
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MsgpackDecoder = exports.MsgpackEncoder = exports.msgpack = void 0;
var pow32 = 0x100000000; // 2^32
exports.msgpack = {
    // Encode a value to a MessagePack byte array.
    //
    // data: The value to serialize. This can be a scalar, array or object.
    encode: function (data) {
        return new MsgpackEncoder().encode(data);
    },
    // Decode a value to a MessagePack byte array.
    //
    // data: The value to serialize.
    decode: function (array) {
        return new MsgpackDecoder().decode(array);
    }
};
var MsgpackEncoder = /** @class */ (function () {
    function MsgpackEncoder() {
    }
    MsgpackEncoder.prototype.encode = function (data) {
        this.array = new Uint8Array(128);
        this.length = 0;
        this.append(data);
        return this.array;
    };
    MsgpackEncoder.prototype.append = function (data) {
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
    };
    MsgpackEncoder.prototype.appendNull = function (data) {
        this.appendByte(0xc0);
    };
    MsgpackEncoder.prototype.appendBoolean = function (data) {
        this.appendByte(data ? 0xc3 : 0xc2);
    };
    MsgpackEncoder.prototype.appendNumber = function (data) {
        if (isFinite(data) && Math.floor(data) === data) {
            // Integer
            if (data >= 0 && data <= 0x7f) {
                this.appendByte(data);
            }
            else if (data < 0 && data >= -0x20) {
                this.appendByte(data);
            }
            else if (data > 0 && data <= 0xff) { // uint8
                this.appendBytes([0xcc, data]);
            }
            else if (data >= -0x80 && data <= 0x7f) { // int8
                this.appendBytes([0xd0, data]);
            }
            else if (data > 0 && data <= 0xffff) { // uint16
                this.appendBytes([0xcd, data >>> 8, data]);
            }
            else if (data >= -0x8000 && data <= 0x7fff) { // int16
                this.appendBytes([0xd1, data >>> 8, data]);
            }
            else if (data > 0 && data <= 0xffffffff) { // uint32
                this.appendBytes([0xce, data >>> 24, data >>> 16, data >>> 8, data]);
            }
            else if (data >= -0x80000000 && data <= 0x7fffffff) { // int32
                this.appendBytes([0xd2, data >>> 24, data >>> 16, data >>> 8, data]);
            }
            else if (data > 0 && data <= 0xffffffffffffffff) { // uint64
                // Split 64 bit number into two 32 bit numbers because JavaScript only regards
                // 32 bits for bitwise operations.
                var hi = data / pow32;
                var lo = data % pow32;
                this.appendBytes([0xd3, hi >>> 24, hi >>> 16, hi >>> 8, hi, lo >>> 24, lo >>> 16, lo >>> 8, lo]);
            }
            else if (data >= -0x8000000000000000 && data <= 0x7fffffffffffffff) { // int64
                this.appendByte(0xd3);
                this.appendInt64(data);
            }
            else if (data < 0) { // below int64
                this.appendBytes([0xd3, 0x80, 0, 0, 0, 0, 0, 0, 0]);
            }
            else { // above uint64
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
    };
    MsgpackEncoder.prototype.appendString = function (data) {
        var bytes = this.encodeUtf8(data);
        var length = bytes.length;
        if (length <= 0x1f) {
            this.appendByte(0xa0 + length);
        }
        else if (length <= 0xff) {
            this.appendBytes([0xd9, length]);
        }
        else if (length <= 0xffff) {
            this.appendBytes([0xda, length >>> 8, length]);
        }
        else {
            this.appendBytes([0xdb, length >>> 24, length >>> 16, length >>> 8, length]);
        }
        this.appendBytes(bytes);
    };
    MsgpackEncoder.prototype.appendArray = function (data) {
        var length = data.length;
        if (length <= 0xf)
            this.appendByte(0x90 + length);
        else if (length <= 0xffff)
            this.appendBytes([0xdc, length >>> 8, length]);
        else
            this.appendBytes([0xdd, length >>> 24, length >>> 16, length >>> 8, length]);
        for (var index = 0; index < length; index++) {
            this.append(data[index]);
        }
    };
    MsgpackEncoder.prototype.appendBinArray = function (data) {
        var length = data.length;
        if (length <= 0xf) {
            this.appendBytes([0xc4, length]);
        }
        else if (length <= 0xffff) {
            this.appendBytes([0xc5, length >>> 8, length]);
        }
        else {
            this.appendBytes([0xc6, length >>> 24, length >>> 16, length >>> 8, length]);
        }
        this.appendBytes(data);
    };
    MsgpackEncoder.prototype.appendObject = function (data) {
        var length = 0;
        for (var key in data) {
            length++;
        }
        if (length <= 0xf) {
            this.appendByte(0x80 + length);
        }
        else if (length <= 0xffff) {
            this.appendBytes([0xde, length >>> 8, length]);
        }
        else {
            this.appendBytes([0xdf, length >>> 24, length >>> 16, length >>> 8, length]);
        }
        for (var key in data) {
            this.append(key);
            this.append(data[key]);
        }
    };
    MsgpackEncoder.prototype.appendDate = function (data) {
        var sec = data.getTime() / 1000;
        if (data.getMilliseconds() === 0 && sec >= 0 && sec < 0x100000000) { // 32 bit seconds
            this.appendBytes([0xd6, 0xff, sec >>> 24, sec >>> 16, sec >>> 8, sec]);
        }
        else if (sec >= 0 && sec < 0x400000000) { // 30 bit nanoseconds, 34 bit seconds
            var ns = data.getMilliseconds() * 1000000;
            this.appendBytes([0xd7, 0xff, ns >>> 22, ns >>> 14, ns >>> 6, ((ns << 2) >>> 0) | (sec / pow32), sec >>> 24, sec >>> 16, sec >>> 8, sec]);
        }
        else { // 32 bit nanoseconds, 64 bit seconds, negative values allowed
            var ns = data.getMilliseconds() * 1000000;
            this.appendBytes([0xc7, 12, 0xff, ns >>> 24, ns >>> 16, ns >>> 8, ns]);
            this.appendInt64(sec);
        }
    };
    MsgpackEncoder.prototype.appendByte = function (byte) {
        if (this.array.length < this.length + 1) {
            var newLength = this.array.length * 2;
            while (newLength < this.length + 1) {
                newLength *= 2;
            }
            var newArray = new Uint8Array(newLength);
            newArray.set(this.array);
            this.array = newArray;
        }
        this.array[this.length] = byte;
        this.length++;
    };
    MsgpackEncoder.prototype.appendBytes = function (bytes) {
        if (this.array.length < this.length + bytes.length) {
            var newLength = this.array.length * 2;
            while (newLength < this.length + bytes.length) {
                newLength *= 2;
            }
            var newArray = new Uint8Array(newLength);
            newArray.set(this.array);
            this.array = newArray;
        }
        this.array.set(bytes, this.length);
        this.length += bytes.length;
    };
    MsgpackEncoder.prototype.appendInt64 = function (value) {
        // Split 64 bit number into two 32 bit numbers because JavaScript only regards 32 bits for
        // bitwise operations.
        var hi, lo;
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
    };
    // Encodes a string to UTF-8 bytes.
    MsgpackEncoder.prototype.encodeUtf8 = function (str) {
        // Prevent excessive array allocation and slicing for all 7-bit characters
        var ascii = true;
        var length = str.length;
        for (var x = 0; x < length; x++) {
            if (str.charCodeAt(x) > 127) {
                ascii = false;
                break;
            }
        }
        // Based on: https://gist.github.com/pascaldekloe/62546103a1576803dade9269ccf76330
        var i = 0;
        var bytes = new Uint8Array(str.length * (ascii ? 1 : 4));
        for (var ci = 0; ci !== length; ci++) {
            var c = str.charCodeAt(ci);
            if (c < 128) {
                bytes[i++] = c;
                continue;
            }
            if (c < 2048) {
                bytes[i++] = c >> 6 | 192;
            }
            else {
                if (c > 0xd7ff && c < 0xdc00) {
                    if (++ci >= length) {
                        throw new Error("UTF-8 encode: incomplete surrogate pair");
                    }
                    var c2 = str.charCodeAt(ci);
                    if (c2 < 0xdc00 || c2 > 0xdfff) {
                        throw new Error("UTF-8 encode: second surrogate character 0x" + c2.toString(16) + " at index " + ci + " out of range");
                    }
                    c = 0x10000 + ((c & 0x03ff) << 10) + (c2 & 0x03ff);
                    bytes[i++] = c >> 18 | 240;
                    bytes[i++] = c >> 12 & 63 | 128;
                }
                else {
                    bytes[i++] = c >> 12 | 224;
                }
                bytes[i++] = c >> 6 & 63 | 128;
            }
            bytes[i++] = c & 63 | 128;
        }
        return ascii ? bytes : bytes.subarray(0, i);
    };
    return MsgpackEncoder;
}());
exports.MsgpackEncoder = MsgpackEncoder;
var MsgpackDecoder = /** @class */ (function () {
    function MsgpackDecoder() {
    }
    MsgpackDecoder.prototype.decode = function (array) {
        this.array = (array instanceof Uint8Array) ? array : new Uint8Array(array);
        this.pos = 0;
        this.data = this.read();
        return this.data;
    };
    MsgpackDecoder.prototype.read = function () {
        var byte = this.array[this.pos++];
        if (byte >= 0x00 && byte <= 0x7f)
            return byte; // positive fixint
        if (byte >= 0x80 && byte <= 0x8f)
            return this.readMap(byte - 0x80); // fixmap
        if (byte >= 0x90 && byte <= 0x9f)
            return this.readArray(byte - 0x90); // fixarray
        if (byte >= 0xa0 && byte <= 0xbf)
            return this.readStr(byte - 0xa0); // fixstr
        if (byte === 0xc0)
            return null; // nil
        if (byte === 0xc1)
            throw new Error("Invalid byte code 0xc1 found."); // never used
        if (byte === 0xc2)
            return false; // false
        if (byte === 0xc3)
            return true; // true
        if (byte === 0xc4)
            return this.readBin(-1, 1); // bin 8
        if (byte === 0xc5)
            return this.readBin(-1, 2); // bin 16
        if (byte === 0xc6)
            return this.readBin(-1, 4); // bin 32
        if (byte === 0xc7)
            return this.readExt(-1, 1); // ext 8
        if (byte === 0xc8)
            return this.readExt(-1, 2); // ext 16
        if (byte === 0xc9)
            return this.readExt(-1, 4); // ext 32
        if (byte === 0xca)
            return this.readFloat(4); // float 32
        if (byte === 0xcb)
            return this.readFloat(8); // float 64
        if (byte === 0xcc)
            return this.readUInt(1); // uint 8
        if (byte === 0xcd)
            return this.readUInt(2); // uint 16
        if (byte === 0xce)
            return this.readUInt(4); // uint 32
        if (byte === 0xcf)
            return this.readUInt(8); // uint 64
        if (byte === 0xd0)
            return this.readInt(1); // int 8
        if (byte === 0xd1)
            return this.readInt(2); // int 16
        if (byte === 0xd2)
            return this.readInt(4); // int 32
        if (byte === 0xd3)
            return this.readInt(8); // int 64
        if (byte === 0xd4)
            return this.readExt(1); // fixext 1
        if (byte === 0xd5)
            return this.readExt(2); // fixext 2
        if (byte === 0xd6)
            return this.readExt(4); // fixext 4
        if (byte === 0xd7)
            return this.readExt(8); // fixext 8
        if (byte === 0xd8)
            return this.readExt(16); // fixext 16
        if (byte === 0xd9)
            return this.readStr(-1, 1); // str 8
        if (byte === 0xda)
            return this.readStr(-1, 2); // str 16
        if (byte === 0xdb)
            return this.readStr(-1, 4); // str 32
        if (byte === 0xdc)
            return this.readArray(-1, 2); // array 16
        if (byte === 0xdd)
            return this.readArray(-1, 4); // array 32
        if (byte === 0xde)
            return this.readMap(-1, 2); // map 16
        if (byte === 0xdf)
            return this.readMap(-1, 4); // map 32
        if (byte >= 0xe0 && byte <= 0xff)
            return byte - 256; // negative fixint
        throw new Error("Invalid byte value " + byte + " in the MessagePack binary data : Expecting a range of 0 to 255. This is not a byte array.");
    };
    MsgpackDecoder.prototype.readInt = function (size) {
        var value = 0;
        var first = true;
        while (size-- > 0) {
            if (first) {
                var byte = this.array[this.pos++];
                value += byte & 0x7f;
                if (byte & 0x80) {
                    value -= 0x80; // Treat most-significant bit as -2^i instead of 2^i
                }
                first = false;
            }
            else {
                value *= 256;
                value += this.array[this.pos++];
            }
        }
        return value;
    };
    MsgpackDecoder.prototype.readUInt = function (size) {
        var value = 0;
        while (size-- > 0) {
            value *= 256;
            value += this.array[this.pos++];
        }
        return value;
    };
    MsgpackDecoder.prototype.readFloat = function (size) {
        var view = new DataView(this.array.buffer, this.pos, size);
        this.pos += size;
        if (size === 4)
            return view.getFloat32(0, false);
        if (size === 8)
            return view.getFloat64(0, false);
    };
    MsgpackDecoder.prototype.readBin = function (size, lengthSize) {
        if (lengthSize === void 0) { lengthSize = 0; }
        if (size < 0)
            size = this.readUInt(lengthSize);
        var data = this.array.subarray(this.pos, this.pos + size);
        this.pos += size;
        return data;
    };
    MsgpackDecoder.prototype.readMap = function (size, lengthSize) {
        if (lengthSize === void 0) { lengthSize = 0; }
        if (size < 0)
            size = this.readUInt(lengthSize);
        var data = {};
        while (size-- > 0) {
            var key = this.read();
            data[key] = this.read();
        }
        return data;
    };
    MsgpackDecoder.prototype.readArray = function (size, lengthSize) {
        if (lengthSize === void 0) { lengthSize = 0; }
        if (size < 0)
            size = this.readUInt(lengthSize);
        var data = [];
        while (size-- > 0) {
            data.push(this.read());
        }
        return data;
    };
    MsgpackDecoder.prototype.readStr = function (size, lengthSize) {
        if (lengthSize === void 0) { lengthSize = 0; }
        if (size < 0)
            size = this.readUInt(lengthSize);
        var start = this.pos;
        this.pos += size;
        return this.decodeUtf8(this.array, start, size);
    };
    MsgpackDecoder.prototype.readExt = function (size, lengthSize) {
        if (lengthSize === void 0) { lengthSize = 0; }
        if (size < 0)
            size = this.readUInt(lengthSize);
        var type = this.readUInt(1);
        var data = this.readBin(size);
        switch (type) {
            case 255:
                return this.readExtDate(data);
        }
        return { type: type, data: data };
    };
    MsgpackDecoder.prototype.readExtDate = function (data) {
        if (data.length === 4) {
            var sec = ((data[0] << 24) >>> 0) +
                ((data[1] << 16) >>> 0) +
                ((data[2] << 8) >>> 0) +
                data[3];
            return new Date(sec * 1000);
        }
        if (data.length === 8) {
            var ns = ((data[0] << 22) >>> 0) +
                ((data[1] << 14) >>> 0) +
                ((data[2] << 6) >>> 0) +
                (data[3] >>> 2);
            var sec = ((data[3] & 0x3) * pow32) +
                ((data[4] << 24) >>> 0) +
                ((data[5] << 16) >>> 0) +
                ((data[6] << 8) >>> 0) +
                data[7];
            return new Date(sec * 1000 + ns / 1000000);
        }
        if (data.length === 12) {
            var ns = ((data[0] << 24) >>> 0) +
                ((data[1] << 16) >>> 0) +
                ((data[2] << 8) >>> 0) +
                data[3];
            this.pos -= 8;
            var sec = this.readInt(8);
            return new Date(sec * 1000 + ns / 1000000);
        }
        throw new Error("Invalid data length for a date value.");
    };
    // Decodes a string from UTF-8 bytes.
    MsgpackDecoder.prototype.decodeUtf8 = function (bytes, start, length) {
        // Based on: https://gist.github.com/pascaldekloe/62546103a1576803dade9269ccf76330
        var i = start, str = "";
        length += start;
        while (i < length) {
            var c = bytes[i++];
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
                else
                    throw new Error("UTF-8 decode: unknown multibyte start 0x" + c.toString(16) + " at index " + (i - 1));
            }
            if (c <= 0xffff)
                str += String.fromCharCode(c);
            else if (c <= 0x10ffff) {
                c -= 0x10000;
                str += String.fromCharCode(c >> 10 | 0xd800);
                str += String.fromCharCode(c & 0x3FF | 0xdc00);
            }
            else
                throw new Error("UTF-8 decode: code point 0x" + c.toString(16) + " exceeds UTF-16 reach");
        }
        return str;
    };
    return MsgpackDecoder;
}());
exports.MsgpackDecoder = MsgpackDecoder;

},{}]},{},[2])(2)
});
