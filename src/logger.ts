import { join, resolve } from 'path';
import { Http2Request, HttpRequest } from './request';
import { Http2Response, HttpResponse } from './response';
import { appendFileSync, existsSync, mkdirSync } from 'fs';

export default class Logger {
    constructor(private readonly dir: string) {
        dir = resolve(dir);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    }

    dateStrColor(d: Date) {
        return '[\x1b[31m' + d.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric'
        }) + ' \x1b[94m' + d.toLocaleTimeString('en-US', {
            hour12: false,
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric'
        }) + '\x1b[0m]';
    }

    dateStr(d: Date = new Date()) {
        return '[' + d.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric'
        }) + ' ' + d.toLocaleTimeString('en-US', {
            hour12: false,
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric'
        }) + ']';
    }

    log(req: HttpRequest | Http2Request, res: HttpResponse | Http2Response) {
        res.on('finish', () => {
            let date = new Date();
            let timestampColor = this.dateStrColor(date);
            let timestamp = this.dateStr(date);
            console.log(`${timestampColor} \x1b[35m${req.ip} \x1b[91m${req.hostname} \x1b[96m${req.method} \x1b[33m${req.url} \x1b[32m${res.statusCode}\x1b[0m`);
            appendFileSync(join(this.dir, 'access.log'), `${timestamp} ${req.hostname} ${req.ip} ${req.method} ${req.url} ${res.statusCode}\n`);
            
            let detailedEntry = `${timestamp} Request complete ->\n`;
            detailedEntry += `\tMethod: ${req.method}\n`;
            detailedEntry += `\tURL: ${req.url}\n`;
            detailedEntry += `\tStatus Code: ${res.statusCode}\n`;
            detailedEntry += `\tRemote Address: ${req.ip}\n`;
            detailedEntry += `\tRemote Port: ${req.ip}\n`;
            detailedEntry += `\tRequest Headers ->\n`;
            for (let header in req.headers) detailedEntry += `\t\t${header}: ${req.headers[header]}\n`;
            detailedEntry += `\tResponse Headers ->\n`;
            for (let header in res.getHeaders()) detailedEntry += `\t\t${header}: ${res.getHeader(header)}\n`;

            appendFileSync(join(this.dir, 'detailed.log'), detailedEntry + '\n');
        });

        appendFileSync(join(this.dir, 'detailed.log'), `${this.dateStr(new Date())} Request started -> ${req.ip} ${req.method} ${req.url}\n`);
    }
}