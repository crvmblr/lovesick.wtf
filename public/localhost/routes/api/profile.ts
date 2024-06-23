import { WithId } from 'mongodb';
import { BackgroundType, IUser, User } from '..';
import { HttpRequest, Http2Request } from '../../../../src/request';
import { HttpResponse, Http2Response } from '../../../../src/response';
import { check } from './login';

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

    let [username, password] = (req.headers.authorization || '')
        .split(' ')[1]
        ?.split(':')
        ?.map((x) => Buffer.from(x, 'base64').toString('utf8'));

    if (!(await check(username, password)))
        return res.status(401).send('Unauthorized');

    let user: WithId<IUser> | null = await User.findOne({
        name: username,
    }).catch(() => null);

    let newProfile: any = {};

    try {
        let data = JSON.parse(body);

        // IF DEV, CAN EDIT ANYONE'S PROFILE
        if (user?.horny && typeof data.name === 'string') username = data.name;

        // BASIC
        if (typeof data.bio === 'string')
            newProfile.bio = data.bio.slice(0, 32768);
        if (typeof data.avatar === 'string')
            newProfile.avatar = data.avatar.slice(0, 8192);
        if (typeof data.theme === 'object') {
            newProfile.theme = {};
            if (typeof data.theme.primary === 'number')
                newProfile.theme.primary = data.theme.primary;
            if (typeof data.theme.accent === 'number')
                newProfile.theme.accent = data.theme.accent;

            if (!newProfile.theme.primary || !newProfile.theme.accent)
                delete newProfile.theme;
        }

        // MUSIC
        if (typeof data.music === 'object') {
            newProfile.music = {};

            if (typeof data.music.name === 'string')
                newProfile.music.name = data.music.name.slice(0, 8192);

            if (typeof data.music.url === 'string')
                newProfile.music.url = data.music.url.slice(0, 8192);

            if (!newProfile.music.url) delete newProfile.music;
        }

        // BACKGROUNDS
        if (typeof data.background === 'object') {
            newProfile.background = {};

            if (Object.values(BackgroundType).includes(data.background.type))
                newProfile.background.type = data.background.type;

            if (typeof data.background.color === 'number')
                newProfile.background.color = data.background.color;

            if (typeof data.background.image === 'string')
                newProfile.background.image = data.background.image.slice(
                    0,
                    8192
                );

            if (typeof data.background.video === 'string')
                newProfile.background.video = data.background.video.slice(
                    0,
                    8192
                );

            if (typeof data.background.opacity === 'number')
                newProfile.background.opacity = Math.max(
                    0,
                    Math.min(1, data.background.opacity)
                );

            if (
                !Object.values(BackgroundType).includes(
                    newProfile.background.type
                )
            )
                delete newProfile.background;

            if (typeof data.embedDescription === 'string')
                newProfile.embedDescription = data.embedDescription.slice(
                    0,
                    32768
                );
        }

        if (typeof data.noSanitize === 'boolean' && user.horny)
            newProfile.noSanitize = data.noSanitize;

        await User.updateOne({ name: username }, { $set: newProfile });
    } catch {
        return res.status(400).send('Bad Request');
    }

    return res.status(200).send('OK');
}
