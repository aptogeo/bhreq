export interface IRequest {
    url: string;
    method?: string;
    timeout?: number;
    body?: any;
    contentType?: string;
    responseType?: string;
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
    responseType: string;
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
