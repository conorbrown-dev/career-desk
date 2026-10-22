import {Pool} from 'pg';
let pool:Pool|undefined;
export function getPool(){if(!process.env.DATABASE_URL)throw Error('Database is not configured');return pool??=new Pool({connectionString:process.env.DATABASE_URL,max:3,idleTimeoutMillis:20000,connectionTimeoutMillis:10000});}
