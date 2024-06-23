/**
 * This file is part of Z3DB0Y's Custom HTTP(s) server.
 * (c) 2023 Z3DB0Y, All rights reserved.
 */
import { Http2ServerResponse } from 'http2';
import { ServerResponse } from 'http';

interface BaseResponse {
    // TODO: Add more properties

    json: (data: any) => void;
    status: (status: number) => HttpResponse | Http2Response;
    sendFile: (path: string) => void;
    send: (data: any) => void;
    redirect: (url: string) => void;
}

export interface HttpResponse extends BaseResponse, ServerResponse {}
export interface Http2Response extends BaseResponse, Http2ServerResponse {}
