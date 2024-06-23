/**
 * This file is part of Z3DB0Y's Custom HTTP(s) server.
 * (c) 2023 Z3DB0Y, All rights reserved.
 */
import {
    Http2SecureServer,
    Http2ServerRequest,
    Http2ServerResponse,
    createSecureServer as createHttp2Server,
} from 'http2';
import {
    Server as HttpServer,
    IncomingMessage,
    ServerResponse,
    createServer as createHttpServer,
} from 'http';
import {
    Server as HttpsServer,
    createServer as createHttpsServer,
} from 'https';
import { SecureContext, SecureContextOptions, createSecureContext } from 'tls';
import { Http2Request, HttpRequest } from './request';
import EventEmitter from 'events';
import { extname, join, resolve as resolvePath } from 'path';
import { Http2Response, HttpResponse } from './response';
import {
    Dirent,
    createReadStream,
    existsSync,
    readFileSync,
    readdirSync,
    statSync,
} from 'fs';
import { getType } from 'mime';
import Logger from './logger';
import { Socket } from 'net';

interface ServerConfig {
    http2?: boolean;
    port?: number;
    host?: string;
    secure?: boolean;
    cert?: string;
    key?: string;
    ca?: string;
    rootDir?: string;
    logging?: boolean;
    logDir?: string;
    trustForwardedFor?: boolean;
}

interface Domain {
    name: string;
    key?: string;
    cert?: string;
    ca?: string;
    subdomains?: Domain[];
    path: string;
}

export default class Server extends EventEmitter {
    private server: Http2SecureServer | HttpServer | HttpsServer;
    config: ServerConfig;
    domains: Domain[] = [];
    logger: Logger | null = null;

    private SNICallback(
        servername: string,
        cb: (err: Error | null, ctx: SecureContext | undefined) => void
    ) {
        if (!this.config.secure)
            throw new Error('SNICallback invoked on an insecure server!');

        let domain = this.domains.find(
            (e) =>
                e.name === servername ||
                (servername.endsWith('.' + e.name) &&
                    e.subdomains.find(
                        (s) => s.name === servername.replace('.' + e.name, '')
                    ))
        );
        let subdomain = domain?.subdomains?.find(
            (e) => e.name === servername.replace('.' + domain.name, '')
        );

        if (!domain) return cb(new Error('Unknown host'), undefined);

        let ctx: SecureContextOptions = {};

        if (subdomain.key || domain.key || this.config.key)
            ctx.key = subdomain.key || domain.key || this.config.key;
        if (subdomain.cert || domain.cert || this.config.cert)
            ctx.cert = subdomain.cert || domain.cert || this.config.cert;
        if (subdomain.ca || domain.ca || this.config.ca)
            ctx.ca = subdomain.ca || domain.ca || this.config.ca;

        cb(null, createSecureContext(ctx));
    }

    private isDocumentDir(dir: Dirent[] | string) {
        let dirEnt =
            typeof dir === 'string'
                ? readdirSync(dir, { withFileTypes: true })
                : dir;
        return (
            dirEnt.findIndex((e) => e.name === 'index.html' && e.isFile()) !==
            -1
        );
    }

    private indexDirectory(
        domain: Domain,
        path: string,
        dir: Dirent[],
        topLevel = true
    ) {
        if (domain && !this.isDocumentDir(dir) && topLevel) {
            let subdomains = dir.filter((e) => e.isDirectory());
            domain.subdomains = domain.subdomains || [];

            for (let subdomain of subdomains) {
                let metadata: Domain = {
                    name: subdomain.name,
                    path: join(path, subdomain.name),
                };

                if (existsSync(join(path, subdomain.name, 'key.pem')))
                    metadata.key = join(path, subdomain.name, 'key.pem');
                if (existsSync(join(path, subdomain.name, 'cert.pem')))
                    metadata.cert = join(path, subdomain.name, 'cert.pem');
                if (existsSync(join(path, subdomain.name, 'ca.pem')))
                    metadata.ca = join(path, subdomain.name, 'ca.pem');

                if (subdomain.name === '~' && topLevel) {
                    domain.path = metadata.path;
                    domain.key = metadata.key;
                    domain.cert = metadata.cert;
                    domain.ca = metadata.ca;

                    if (!domain.key) delete domain.key;
                    if (!domain.cert) delete domain.cert;
                    if (!domain.ca) delete domain.ca;

                    continue;
                }

                domain.subdomains.push(metadata);
                this.indexDirectory(
                    metadata,
                    join(path, subdomain.name),
                    readdirSync(join(path, subdomain.name), {
                        withFileTypes: true,
                    }),
                    false
                );
            }

            return;
        }

        if (this.isDocumentDir(dir) && topLevel) {
            if (existsSync(join(path, 'routes')))
                this.indexDirectory(
                    domain,
                    join(path, 'routes'),
                    readdirSync(join(path, 'routes'), { withFileTypes: true }),
                    false
                );
            if (existsSync(join(path, 'mixins')))
                this.indexDirectory(
                    domain,
                    join(path, 'mixins'),
                    readdirSync(join(path, 'mixins'), { withFileTypes: true }),
                    false
                );

            return;
        }

        for (let file of dir) {
            if (file.isDirectory()) {
                this.indexDirectory(
                    domain,
                    join(path, file.name),
                    readdirSync(join(path, file.name), { withFileTypes: true }),
                    false
                );
                continue;
            }

            if (file.isFile() && file.name.endsWith('.ts'))
                try {
                    import(join(path, file.name));
                } catch (e) {
                    console.error('Middleware import error:', e);
                }
        }
    }

    private indexRootDirectory() {
        let index = readdirSync(this.config.rootDir, { withFileTypes: true });

        if (this.isDocumentDir(index))
            return this.indexDirectory(null, this.config.rootDir, index);
        else {
            let domains = index.filter((e) => e.isDirectory());
            for (let domain of domains) {
                let metadata: Domain = {
                    name: domain.name,
                    path: join(this.config.rootDir, domain.name),
                };

                if (
                    existsSync(
                        join(this.config.rootDir, domain.name, 'key.pem')
                    )
                )
                    metadata.key = join(
                        this.config.rootDir,
                        domain.name,
                        'key.pem'
                    );
                if (
                    existsSync(
                        join(this.config.rootDir, domain.name, 'cert.pem')
                    )
                )
                    metadata.cert = join(
                        this.config.rootDir,
                        domain.name,
                        'cert.pem'
                    );
                if (
                    existsSync(join(this.config.rootDir, domain.name, 'ca.pem'))
                )
                    metadata.ca = join(
                        this.config.rootDir,
                        domain.name,
                        'ca.pem'
                    );

                this.domains.push(metadata);
                this.indexDirectory(
                    metadata,
                    join(this.config.rootDir, domain.name),
                    readdirSync(join(this.config.rootDir, domain.name), {
                        withFileTypes: true,
                    })
                );
            }
        }
    }

    private async upgradeCallback(
        oreq: IncomingMessage,
        socket: Socket,
        head: Buffer
    ) {
        let req = oreq as HttpRequest;
        this.extendBase(req);

        let domain = this.domains.find(
            (e) =>
                e.name === req.hostname ||
                (req.hostname.endsWith('.' + e.name) &&
                    e.subdomains?.find(
                        (s) => s.name === req.hostname.replace('.' + e.name, '')
                    ))
        );
        let subdomain = domain?.subdomains?.find(
            (e) => e.name === req.hostname.replace('.' + domain.name, '')
        );

        if (!domain) return socket.destroy();

        let basePath = subdomain?.path || domain.path;

        if (this.isDocumentDir(basePath)) basePath = join(basePath, 'routes');

        let routePath: string | null = null;

        let steps = req.pathname.split('/');

        if (
            existsSync(join(basePath, req.pathname + '.ts')) &&
            statSync(join(basePath, req.pathname + '.ts')).isFile()
        )
            routePath = join(basePath, req.pathname + '.ts');
        else if (
            existsSync(join(basePath, req.pathname, 'index.ts')) &&
            statSync(join(basePath, req.pathname, 'index.ts')).isFile()
        )
            routePath = join(basePath, req.pathname, 'index.ts');

        for (let i = steps.length; i > 0; i--) {
            if (routePath) break;

            let stepPath = join(steps.slice(0, i).join('/'));
            let route = join(basePath, stepPath);

            if (
                route !== basePath &&
                existsSync(route + '.ts') &&
                statSync(route + '.ts').isFile()
            )
                routePath = route + '.ts';
            else if (
                existsSync(route) &&
                statSync(route).isDirectory() &&
                existsSync(join(route, 'index.ts')) &&
                statSync(join(route, 'index.ts')).isFile()
            )
                routePath = join(route, 'index.ts');
        }

        if (!routePath) return socket.destroy();

        try {
            let route = await import(routePath);

            if (
                this.validateMiddleware(route?.default) &&
                route.default.length == 3
            )
                return route.default(req, socket, head);
            return socket.destroy();
        } catch {
            socket.destroy();
        }
    }

    private notFound(
        req: HttpRequest | Http2Request,
        res: HttpResponse | Http2Response,
        path: string
    ) {
        // TODO: Implement 404 page
        res.writeHead(404, {
            'content-type': 'text/plain; charset=utf-8',
        }).end(
            'Cannot ' + (req.method || '').toUpperCase() + ' ' + req.pathname
        );
    }

    private findAndRunMixin(
        req: HttpRequest | Http2Request,
        res: HttpResponse | Http2Response,
        path: string,
        fileToSend: string
    ) {
        let extension = extname(req.pathname).slice(1) || 'html';

        if (existsSync(join(path, 'mixins', extension + '.ts'))) {
            try {
                let mixin = require(join(path, 'mixins', extension + '.ts'));
                if (typeof mixin.default === 'function') {
                    mixin.default(req, res, fileToSend);
                    return true;
                }
            } catch {}
        }

        return false;
    }

    private fileModeRequest(
        req: HttpRequest | Http2Request,
        res: HttpResponse | Http2Response,
        path: string
    ) {
        let filePath = join(path, req.pathname);
        let routesFolder = join(path, 'routes');
        let mixinsFolder = join(path, 'mixins');
        let basePathExists = existsSync(filePath);

        if (
            !filePath.startsWith(path) ||
            filePath.startsWith(routesFolder) ||
            filePath.startsWith(mixinsFolder)
        )
            return this.notFound(req, res, path);
        let blacklistFile = join(path, 'blacklist.txt');
        let blacklist: string[] = [];
        if (existsSync(blacklistFile) && statSync(blacklistFile).isFile())
            blacklist = readFileSync(blacklistFile, 'utf8')
                .split('\n')
                .map((x) => x.trim())
                .filter((x) => x);

        let baseStat = basePathExists ? statSync(filePath) : null;
        let fileToSend: string | null = null;

        if (
            basePathExists &&
            baseStat.isDirectory() &&
            existsSync(join(filePath, 'index.html')) &&
            statSync(join(filePath, 'index.html')).isFile()
        ) {
            if (!req.pathname.endsWith('/'))
                return res.redirect(req.pathname + '/');
            fileToSend = join(filePath, 'index.html');
        } else if (
            filePath !== path &&
            existsSync(filePath + '.html') &&
            statSync(filePath + '.html').isFile()
        )
            fileToSend = filePath + '.html';
        else if (basePathExists && baseStat.isFile()) fileToSend = filePath;

        if (
            blacklist.some(
                (file) =>
                    fileToSend?.startsWith(join(path, file)) ||
                    filePath.startsWith(join(path, file))
            ) ||
            fileToSend == blacklistFile
        )
            return this.notFound(req, res, path);

        if (fileToSend && !this.findAndRunMixin(req, res, path, fileToSend))
            return res.sendFile(fileToSend);
        else if (fileToSend) return;

        this.middlewareModeRequest(req, res, join(path, 'routes'));
    }

    private validateMiddleware(middleware: any) {
        return typeof middleware === 'function';
    }

    private async middlewareModeRequest(
        req: HttpRequest | Http2Request,
        res: HttpResponse | Http2Response,
        path: string
    ) {
        if (!existsSync(path)) return this.notFound(req, res, path);
        let filePath = join(path, req.pathname);
        let routePath: string | null = null;

        if (
            filePath !== path &&
            existsSync(filePath + '.ts') &&
            statSync(filePath + '.ts').isFile()
        )
            routePath = filePath + '.ts';
        else if (
            existsSync(filePath) &&
            statSync(filePath).isDirectory() &&
            existsSync(join(filePath, 'index.ts')) &&
            statSync(join(filePath, 'index.ts')).isFile()
        )
            routePath = join(filePath, 'index.ts');

        let steps = req.pathname.split('/');
        for (let i = steps.length; i > 0; i--) {
            if (routePath) break;

            let stepPath = join(steps.slice(0, i).join('/'));
            let route = join(path, stepPath);

            if (
                route !== path &&
                existsSync(route + '.ts') &&
                statSync(route + '.ts').isFile()
            )
                routePath = route + '.ts';
            else if (
                existsSync(route) &&
                statSync(route).isDirectory() &&
                existsSync(join(route, 'index.ts')) &&
                statSync(join(route, 'index.ts')).isFile()
            )
                routePath = join(route, 'index.ts');
        }

        if (!routePath) return this.notFound(req, res, path);

        try {
            let route = await import(routePath);

            if (
                this.validateMiddleware(route?.default) &&
                route.default.length == 2
            )
                return route.default(req, res);
            return this.notFound(req, res, path);
        } catch (e) {
            console.error('Middleware error:', e);
        }
    }

    private internalMiddleware(
        req: HttpRequest | Http2Request,
        res: HttpResponse | Http2Response
    ) {
        if (this.logger) this.logger.log(req, res);

        let domain = this.domains.find(
            (e) =>
                e.name === req.hostname ||
                (req.hostname.endsWith('.' + e.name) &&
                    e.subdomains?.find(
                        (s) => s.name === req.hostname.replace('.' + e.name, '')
                    ))
        );
        let subdomain = domain?.subdomains?.find(
            (e) => e.name === req.hostname.replace('.' + domain.name, '')
        );

        if (!domain)
            return res
                .writeHead(400, {
                    'content-type': 'text/plain; charset=utf-8',
                })
                .end('Unknown host');

        if (this.isDocumentDir(subdomain?.path || domain.path))
            return this.fileModeRequest(
                req,
                res,
                subdomain?.path || domain.path
            );
        this.middlewareModeRequest(req, res, subdomain?.path || domain.path);
    }

    private extendBase(
        req: HttpRequest | Http2Request,
        res?: HttpResponse | Http2Response
    ) {
        //? Implement methods/properties here

        if (this.config.trustForwardedFor) {
            let forwardedFor = req.headers['x-forwarded-for'];
            if (!forwardedFor || !forwardedFor.length) {
                req.ip = req.socket.remoteAddress;
            } else {
                if (Array.isArray(forwardedFor))
                    req.ip = forwardedFor[0].split(',')[0];
                else if (typeof forwardedFor === 'string')
                    req.ip = forwardedFor.split(',')[0];
            }
        } else req.ip = req.socket.remoteAddress;

        let url = new URL(
            'http://' +
                (req.headers[':authority'] || req.headers.host) +
                req.url
        );

        req.query = Object.fromEntries(url.searchParams.entries());
        req.pathname = decodeURIComponent(url.pathname);
        req.hostname = url.hostname;

        if (res) {
            res.json = (data: any) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
            };

            res.status = (status: number) => {
                res.statusCode = status;
                return res;
            };

            res.sendFile = (path: string) => {
                // TODO: Caching
                let ext = extname(path).slice(1) || 'txt';
                let type = getType(ext);

                if (ext != 'ico')
                    res.setHeader('Content-Type', type || 'text/plain');
                else res.setHeader('Content-Type', 'image/x-icon');

                createReadStream(path).pipe(res);
            };

            res.send = (data: any) => {
                res.write(data);
                res.end();
            };

            res.redirect = (url: string) => {
                res.writeHead(302, {
                    Location: url,
                }).end();
            };
        }
    }

    private http1Callback(req: IncomingMessage, res: ServerResponse) {
        let request = req as HttpRequest;
        let response = res as HttpResponse;

        this.extendBase(request, response);
        this.internalMiddleware(request, response);
    }

    private http2Callback(req: Http2ServerRequest, res: Http2ServerResponse) {
        let request = req as Http2Request;
        let response = res as Http2Response;

        this.extendBase(request, response);
        this.internalMiddleware(request, response);
    }

    constructor(config: ServerConfig) {
        super();

        config.rootDir = resolvePath(config.rootDir) || process.cwd();
        this.config = config;

        this.indexRootDirectory();

        if (config.http2)
            this.server = createHttp2Server(
                {
                    SNICallback: this.SNICallback,
                },
                this.http2Callback.bind(this)
            );
        else if (config.secure)
            this.server = createHttpsServer(
                {
                    SNICallback: this.SNICallback,
                },
                this.http1Callback.bind(this)
            );
        else this.server = createHttpServer(this.http1Callback.bind(this));

        this.server.on('error', this.emit.bind(this, 'error'));
        this.server.on('upgrade', this.upgradeCallback.bind(this));

        if (config.logging)
            this.logger = new Logger(
                config.logDir || resolvePath(config.rootDir, '../logs')
            );
    }

    public listen(port?: number, host?: string, callback?: () => void) {
        port = port || (this.config.secure ? 443 : 80);
        host = host || '0.0.0.0';

        this.server.listen(port, host, callback);
    }
}
