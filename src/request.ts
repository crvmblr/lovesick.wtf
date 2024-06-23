/**
 * This file is part of Z3DB0Y's Custom HTTP(s) server.
 * (c) 2023 Z3DB0Y, All rights reserved.
 */
import { Http2ServerRequest } from 'http2';
import { IncomingMessage } from 'http';

interface BaseRequest {
    // TODO: Add more properties

    query: {
        [key: string]: string | undefined;
    };

    ip: string;
    pathname: string;
    hostname: string;
}

export interface HttpRequest extends BaseRequest, IncomingMessage {}
export interface Http2Request extends BaseRequest, Http2ServerRequest {}