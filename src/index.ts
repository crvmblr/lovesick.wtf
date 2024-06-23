/**
 * This file is part of Z3DB0Y's Custom HTTP(s) server.
 * (c) 2023 Z3DB0Y, All rights reserved.
 */
import Server from './server';
import { server as config } from '../config.json';

const server = new Server(config);
server.listen(config.port, config.host);