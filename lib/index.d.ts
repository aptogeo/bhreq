export interface IRequest {
    url: string;
    method?: string;
    responseType?: string;
    timeout?: number;
    body?: any;
    contentType?: string;
    headers?: {
        [key: string]: string;
    };
    callbackParam?: string;
}
export interface IResponse {
    text: string;
    body: any;
    statusText: string;
    status: number;
    contentType: string;
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
