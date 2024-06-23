import { readFileSync } from 'fs';
import { HttpRequest, Http2Request } from '../../../src/request';
import { HttpResponse, Http2Response } from '../../../src/response';
import { join } from 'path';
import { marked } from 'marked';

export default async function (
    req: HttpRequest | Http2Request,
    res: HttpResponse | Http2Response
) {
    res.setHeader('Content-Type', 'text/html; charset=utf8');
    res.write('<link rel="stylesheet" href="/style/md.css">\n<body>\n');
    res.write(
        marked(readFileSync(join(__dirname, '../', req.pathname), 'utf8'))
    );
    res.end('\n</body>');
}
