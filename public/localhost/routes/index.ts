import { HttpRequest, Http2Request } from '../../../src/request';
import { HttpResponse, Http2Response } from '../../../src/response';
import config from '../../../config.json';
import { MongoClient } from 'mongodb';
import { join } from 'path';
import { createReadStream } from 'fs';

// MONGODB
export const mongo = new MongoClient(
    'mongodb://' + config.db.host + ':' + config.db.port,
    {
        auth: {
            username: config.db.user,
            password: config.db.pass,
        },
    }
);

export enum SocialType {
    // TODO: add more
    Discord = 'discord',
}

export enum BackgroundType {
    None,
    Color,
    Image,
    Video,
}

export interface IUser {
    name: string;
    pass: string;
    salt: string;
    bio: string;
    noSanitize?: boolean;
    socials: {
        type: SocialType;
        url: string;
    }[];
    theme: {
        primary: number; // 4 bytes - RGBA (0xFF0000FF = red, for example)
        accent: number;
    };
    music: {
        name: string;
        url: string;
    };
    avatar: string;
    background: {
        type: BackgroundType;
        color: number;
        image: string;
        video: string;
    };
    embedDescription: string;

    horny?: boolean; // >,< (dev flag)
}

export const db = mongo.db(config.db.name);
export const User = db.collection<IUser>('users');

// UTILITIES
function escapeHtml(unsafe: string) {
    return unsafe.replaceAll(/[&<>/"']/g, '');
}

let getColor = (color) =>
    color < 1 || color > 0xffffffff
        ? null
        : '#' +
          ((color >> 24) & 0xff).toString(16).padStart(2, '0') +
          ((color >> 16) & 0xff).toString(16).padStart(2, '0') +
          ((color >> 8) & 0xff).toString(16).padStart(2, '0');

// HANDLER
export default async function (
    req: HttpRequest | Http2Request,
    res: HttpResponse | Http2Response
) {
    let user = await User.findOne({ name: req.pathname.slice(1) }).catch(
        () => null
    );

    if (!user) return res.status(404).sendFile(join(__dirname, '404.html'));

    delete user._id;
    delete user.pass;
    delete user.salt;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    res.write(
        '<meta name="theme-color" content="' +
            getColor(user.theme.primary) +
            '">'
    );
    res.write(
        '<meta name="og:image" content="' +
            user.avatar.replace(/"/g, '\\"') +
            '">'
    );
    res.write(
        '<meta name="og:title" content="' +
            user.name.replace(/"g/, '\\"') +
            '">'
    );
    res.write(
        '<meta name="og:description" content="' +
            escapeHtml(user.embedDescription || '') +
            '">'
    );

    res.write(
        '<script>window.profile = ' +
            JSON.stringify(user).replace(/\//g, '\\/') +
            '</script>'
    );
    createReadStream(join(__dirname, 'profile.html')).pipe(res);
}
