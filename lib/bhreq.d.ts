export interface IRequest {
    url: string;
    method?: string;
    timeout?: number;
    body?: any;
    params?: {
        [key: string]: string;
    };
    contentType?: string;
    responseType?: XMLHttpRequestResponseType;
    headers?: {
        [key: string]: string;
    };
}
export interface IResponse {
    text: string;
    body: any;
    statusText: string;
    status: number;
    contentType: string;
    responseType: XMLHttpRequestResponseType;
    headers: {
        [key: string]: string;
    };
}
/**
 * Send request.
 *
 * @param {IRequest} request
 * @returns {Promise<IResponse>}
 */
export declare function send(request: IRequest): Promise<IResponse>;
/**
 * Before send interceptor.
 */
export declare type BeforeSendInterceptor = (params: IRequest) => IRequest;
/**
 * After received interceptor.
 */
export declare type AfterReceivedInterceptor = (params: IResponse) => IResponse;
export declare class Engine {
    private static instances;
    beforeSendInterceptors: BeforeSendInterceptor[];
    afterReceivedInterceptors: AfterReceivedInterceptor[];
    private constructor();
    static getInstance(name?: string): Engine;
    send(rawRequest: IRequest): Promise<IResponse>;
    private treatResponse;
}
