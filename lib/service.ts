import {Repository} from './repository';
import {getPool} from './db';
export function repository(){return new Repository(getPool())}
