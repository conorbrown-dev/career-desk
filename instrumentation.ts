// Next.js calls onRequestError for errors thrown while rendering pages or handling routes.
export async function onRequestError(error:unknown,request:{path:string;method:string},context:{routePath?:string;routeType?:string}){
 if(process.env.NEXT_RUNTIME!=='nodejs')return;
 const {reportError}=await import('./lib/error-report');
 await reportError(error,{route:context.routePath||request.path,method:request.method,source:`next:${context.routeType||'request'}`});
}
