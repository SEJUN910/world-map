// Configures the existing Supabase project; never prints provider credentials.
import env from '@next/env';
import { readFile, writeFile } from 'node:fs/promises';
env.loadEnvConfig(process.cwd());
const apply=process.argv.includes('--apply');
const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://invalid.invalid');
if(!/^[a-z]{20}\.supabase\.co$/.test(url.hostname)) throw Error('A hosted NEXT_PUBLIC_SUPABASE_URL is required.');
const ref=url.hostname.split('.')[0];
const origin=new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password) throw Error('Invalid site origin.');
const callbacks=[`${origin.origin}/auth/callback`,'http://localhost:3000/auth/callback','http://127.0.0.1:3000/auth/callback'];
console.log(JSON.stringify({project:ref,googleRedirect:`${url.origin}/auth/v1/callback`,appCallbacks:callbacks,mode:apply?'apply':'dry-run'}));
if(!apply) process.exit(0);
const id=process.env.GOOGLE_CLIENT_ID?.trim(), secret=process.env.GOOGLE_CLIENT_SECRET?.trim();
if(!id?.endsWith('.apps.googleusercontent.com')||!secret) throw Error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local first.');
let token=process.env.SUPABASE_ACCESS_TOKEN;
const credentialsAt=process.argv.indexOf('--credentials');
if(credentialsAt!==-1){
  const credentials=JSON.parse(await readFile(process.argv[credentialsAt+1],'utf8'));
  if(credentials.projectRef!==ref) throw Error('Credential project mismatch.');
  token=credentials.accessToken;
}
if(!token) throw Error('Supply SUPABASE_ACCESS_TOKEN or --credentials <local JSON file>. Never commit credentials.');
const endpoint=`https://api.supabase.com/v1/projects/${ref}/config/auth`;
async function request(method,body){
  const response=await fetch(endpoint,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  if(!response.ok) throw Error(`Supabase auth configuration failed (HTTP ${response.status}).`);
  return response.json();
}
const before=await request('GET');
const allow=[...new Set([...(before.uri_allow_list||'').split(',').filter(Boolean),...callbacks])].join(',');
await request('PATCH',{external_google_enabled:true,external_google_client_id:id,external_google_secret:secret,security_manual_linking_enabled:true,uri_allow_list:allow,site_url:origin.origin});
const after=await request('GET');
if(!after.external_google_enabled||!after.security_manual_linking_enabled) throw Error('Provider settings not confirmed.');
const file='.env.local';let local=await readFile(file,'utf8');
local=/^GOOGLE_AUTH_ENABLED=.*$/m.test(local)?local.replace(/^GOOGLE_AUTH_ENABLED=.*$/m,'GOOGLE_AUTH_ENABLED=true'):`${local.trimEnd()}\nGOOGLE_AUTH_ENABLED=true\n`;
await writeFile(file,local,'utf8');
console.log('Google provider and identity linking enabled. Restart Next.js; set GOOGLE_AUTH_ENABLED=true in the deployment environment too.');
