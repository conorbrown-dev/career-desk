// Keep Better Auth responsible for token consumption and deletion. Present its
// callback errors without exposing raw JSON or carrying the email token onward.
export function deletionResult(request:Request,response:Response){
 if(new URL(request.url).pathname!=='/api/auth/delete-user/callback'||response.status<400)return response;
 const headers=new Headers(response.headers);
 headers.delete('content-type');headers.delete('content-length');
 headers.set('location',new URL('/account-deleted?result=unconfirmed',request.url).toString());
 headers.set('cache-control','no-store');headers.set('referrer-policy','no-referrer');
 return new Response(null,{status:303,headers});
}
