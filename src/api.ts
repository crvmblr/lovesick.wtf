/**
 * This file is part of Z3DB0Y's Custom HTTP(s) server.
 * (c) 2023 Z3DB0Y, All rights reserved.
 */
import { RequestOptions, request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { MongoClient } from 'mongodb';
import { db } from '../config.json';
import { Http2Request, HttpRequest } from './request';
import { Http2Response, HttpResponse } from './response';
import Middleware from './middleware';


export let mongo = new MongoClient('mongodb://' + db.host + ':' + db.port, Object.assign({}, (db as any).user && (db as any).pass ? {
    auth: {
        username: db.user,
        password: db.pass
    }
} : {}));

export function proxyMiddleware (target: URL, opts?: RequestOptions, onError?: Middleware) {
    return (req: HttpRequest | Http2Request, res: HttpResponse | Http2Response) => {
        let request = httpRequest;
        if (target.protocol.endsWith('s:')) request = httpsRequest;
        target.pathname = req.pathname;
    
        let proxyReq = request(target, opts, proxyRes => {
            let errorCallback = () => {
                if (onError) return onError(req, res);
                
                if (!res.headersSent) res.writeHead(500, {
                    'content-type': 'text/html; charset=utf-8'
                });

                if (!res.writableEnded) res.end();
            };

            res.writeHead(proxyRes.statusCode, proxyRes.headers);

            proxyRes.pipe(res);
            proxyReq.once('error', errorCallback);
            proxyRes.once('error', errorCallback);
        });

        req.pipe(proxyReq);
    }
}