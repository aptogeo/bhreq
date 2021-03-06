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
//# sourceMappingURL=bhreq.js.map