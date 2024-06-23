/**
 * This file is part of Z3DB0Y's Custom HTTP(s) server.
 * (c) 2023 Z3DB0Y, All rights reserved.
 */
import { Http2Request, HttpRequest } from './request';
import { Http2Response, HttpResponse } from './response';
import internal from 'stream';

export default interface Middleware {
    (req: HttpRequest | Http2Request, res: HttpResponse | Http2Response): any;
}

export default interface UpgradeMiddleware {
    (req: HttpRequest | Http2Request, socket: internal.Duplex, head: Buffer): any;
}