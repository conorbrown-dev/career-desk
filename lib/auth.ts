import {betterAuth} from 'better-auth';
import {APIError} from 'better-auth/api';
import {jwt} from 'better-auth/plugins/jwt';
import {mcp} from '@better-auth/mcp';
import {cimd} from '@better-auth/cimd';
import {fetchClientMetadataResource} from '@better-auth/cimd/node';
import {mcpResource,pluginScopes} from './plugin-config';
import {nextCookies} from 'better-auth/next-js';
import {getPool} from './db';
import {configured} from './config';
function initializeAuth(){return betterAuth({disabledPaths:['/token'],database:getPool(),secret:process.env.BETTER_AUTH_SECRET,baseURL:process.env.BETTER_AUTH_URL,emailAndPassword:{enabled:true,revokeSessionsOnPasswordReset:true,disableSignUp:process.env.ALLOW_SIGNUP!=='true',minPasswordLength:12},databaseHooks:{user:{create:{before:async(user)=>{const allowed=(process.env.PILOT_SIGNUP_EMAILS||'').split(',').map(email=>email.trim().toLowerCase()).filter(Boolean);if(!allowed.includes(user.email.toLowerCase()))throw new APIError('FORBIDDEN',{message:'Registration is limited to invited pilot users.'});return {data:user};}}}},rateLimit:{enabled:true,storage:'database',window:60,max:60,customRules:{'/sign-in/email':{window:60,max:5},'/sign-up/email':{window:60,max:3}}},session:{cookieCache:{enabled:true,maxAge:60}},plugins:[jwt(),mcp({loginPage:'/sign-in',consentPage:'/connect/consent',resource:mcpResource,scopes:pluginScopes,grantTypes:['authorization_code','refresh_token'],accessTokenExpiresIn:900,refreshTokenExpiresIn:2592000}),cimd({fetchClientMetadataResource,metadataProfile:'mcp-2026-07-28'}),nextCookies()]});}

let instance:ReturnType<typeof initializeAuth>|undefined;
export function getAuth(){if(!configured())throw Error('Account setup is not complete');return instance??=initializeAuth()}
