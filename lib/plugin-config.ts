export const origin=process.env.BETTER_AUTH_URL||'http://localhost:3000';
export const mcpResource=new URL('/mcp',origin).href;
export const pluginScopes=['openid','profile','email','offline_access','career:read','career:prepare'];
export const scopeLabels:Record<string,string>={openid:'Identify your Career Desk account',profile:'Read your account name',email:'Read your account email',offline_access:'Refresh this connection for scheduled tasks; reconnect when authorization expires','career:read':'Read your search profile, applications, activity, and saved PDFs','career:prepare':'Save opportunities, preparation documents, and discovery activity'};
