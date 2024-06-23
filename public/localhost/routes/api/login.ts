import { createHash } from 'crypto';
import { HttpRequest, Http2Request } from '../../../../src/request';
import { HttpResponse, Http2Response } from '../../../../src/response';
import { User } from '../index';

export async function check(username: string, password: string) {
    const user = await User.findOne({ name: username });
    if (!user) return false;
    return (
        createHash('sha256')
            .update(password + user.salt)
            .digest('hex') === user.pass
    );
}

export default async function (
    req: HttpRequest | Http2Request,
    res: HttpResponse | Http2Response
) {
    if (req.method !== 'POST')
        return res.status(405).send('Method Not Allowed');

    let body = await new Promise<string>((resolve) => {
        let data = '';
        req.on('data', (chunk) => (data += chunk));
        req.on('end', () => resolve(data));
    });

    let { username, password } = JSON.parse(body);
    if (!(await check(username, password)))
        return res.status(401).send('Unauthorized');

    let user = await User.findOne({ name: username });

    delete user._id;
    delete user.pass;
    delete user.salt;

    return res.status(200).json(user);
}
