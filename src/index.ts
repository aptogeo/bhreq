export interface IRequest {
  url: string;
  method?: string;
  timeout?: number;
  body?: any;
  contentType?: string;
  responseType?: string;
  headers?: { [key: string]: string };
}

export interface IResponse {
  text: string;
  body: any;
  statusText: string;
  status: number;
  contentType: string;
  responseType: string;
  headers: { [key: string]: string };
}

const defaultTimeout = 10000;

const defaultMethod = 'GET';

const contentTypeHeaderName = 'Content-Type';

const timeoutError = {
  status: 408,
  statusText: 'Request timeout'
};

const indeterminateResponseError = {
  status: 409,
  statusText: 'Unable to determine the response'
};

const unparsableResponseError = {
  status: 409,
  statusText: 'Unable to parse the response'
};

const unopenableRequestError = {
  status: 409,
  statusText: 'Unable to open the request'
};

const unsendableRequestError = {
  status: 409,
  statusText: 'Unable to sebd the request'
};

function deserializeBody(data: any, contentType: string): any {
  if (typeof data === 'string') {
    if (/[+-/]json($|[+-;])/.test(contentType)) {
      // is JSON
      try {
        return JSON.parse(data);
      } catch (err) {
        console.error(`Error to parse JSON ${err}`);
      }
    } else if (/[+-/]form($|[+-;])/.test(contentType)) {
      // is Form
      const keyValues = data.split('&');
      const deserializedData = {} as any;
      for (const keyValue of keyValues) {
        const parts = keyValue.split('=');
        if (parts.length === 2) {
          const key = decodeURIComponent(parts[0]);
          const value = decodeURIComponent(parts[1]);
          deserializedData[key] = value;
        }
      }
    } else {
      return data;
    }
  } else {
    return data;
  }
}

function serializeBody(data: any, contentType: string): any {
  let serializedData = data;
  if (typeof data === 'object') {
    if (/[+-/]json($|[+-;])/.test(contentType)) {
      // is JSON
      serializedData = JSON.stringify(data);
    } else if (/[+-/]form($|[+-;])/.test(contentType)) {
      // is Form
      const keyValues: string[] = [];
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          keyValues.push(`${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`);
        }
      }
      serializedData = keyValues.join('&');
    }
  }
  return serializedData;
}

function deserializeHeaders(data: string): { [key: string]: string } {
  const headers: { [key: string]: string } = {};
  const lines = data.split(/\r?\n/);
  for (const line of lines) {
    const parts = line.split(':');
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
export function send(request: IRequest): Promise<IResponse> {
  const normUrl = request.url.replace(/[^:](\/{2,})/g, '/').replace(/\/\.\//g, '/');
  return new Promise((resolve, reject) => {
    const client = new XMLHttpRequest();
    let timer = setTimeout(
      () => {
        timer = null;
        try {
          client.abort();
        } catch (err) {
          // Nothing
        }
        reject(timeoutError);
      },
      request && request.timeout ? request.timeout : defaultTimeout
    );
    client.onreadystatechange = () => {
      if (client.readyState >= 2 && timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (client.readyState !== 4) {
        return;
      }
      let status;
      let statusText;
      try {
        // Normalize IE's statusText to "No Content" instead of "Unknown".
        status = client.status === 1223 ? 204 : client.status;
        // Normalize IE's statusText to "No Content" instead of "Unknown".
        statusText = client.status === 1223 ? 'No Content' : client.statusText;
      } catch (err) {
        console.error(`${indeterminateResponseError.statusText}: ${err}`);
        reject(indeterminateResponseError);
      }
      if (status < 200 && status >= 300) {
        reject({
          status,
          statusText
        });
      }
      try {
        const raw = client.response;
        const responseType = client.responseType;
        // ResponseText is accessible only if responseType is '' or 'text' and on older browsers
        const text =
          ((request.method !== 'HEAD' && (responseType === '' || responseType === 'text')) ||
          (typeof responseType === 'undefined'))
            ? client.responseText
            : null;
        const contentType = client.getResponseHeader(contentTypeHeaderName);
        resolve({
          responseType,
          text,
          body: deserializeBody(text ? text : raw, contentType),
          status,
          statusText,
          contentType,
          headers: deserializeHeaders(client.getAllResponseHeaders())
        });
      } catch (err) {
        console.error(`${unparsableResponseError.statusText}: ${err}`);
        reject(unparsableResponseError);
      }
    };
    try {
      client.open(request.method ? request.method : defaultMethod, normUrl);
    } catch (err) {
      console.error(`${unopenableRequestError.statusText}: ${err}`);
      reject(unopenableRequestError);
    }
    try {
      if (request.headers) {
        for (const key in request.headers) {
          if (key.toLowerCase() === contentTypeHeaderName.toLowerCase()) {
            request.contentType = request.headers[key];
          } else {
            client.setRequestHeader(key, request.headers[key]);
          }
        }
      }
      if (request.contentType) {
        client.setRequestHeader(contentTypeHeaderName, request.contentType);
      }
      if (request.responseType) {
        client.responseType = request.responseType as XMLHttpRequestResponseType;
      }
      if (request.body) {
        client.send(serializeBody(request.body, request.contentType));
      } else {
        client.send();
      }
    } catch (err) {
      console.error(`${unsendableRequestError.statusText}: ${err}`);
      reject(unsendableRequestError);
    }
  });
}
