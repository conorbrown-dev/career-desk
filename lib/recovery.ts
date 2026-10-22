import {HttpError} from './http';

export function recoveryGrant(userEmail:string,env:Record<string,string|undefined>=process.env){
 const email=env.CAREER_RECOVERY_EMAIL?.trim().toLowerCase();
 const expires=Date.parse(env.CAREER_RECOVERY_EXPIRES||'');
 const token=env.CAREER_RECOVERY_TOKEN;
 if(!email||!token||token.length<40||!Number.isFinite(expires)||expires<=Date.now())throw new HttpError(403,'This recovery window is closed.');
 if(userEmail.toLowerCase()!==email)throw new HttpError(403,'Recovery is not enabled for this account.');
 return token;
}
