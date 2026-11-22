import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {createRemoteJWKSet,importPKCS8,SignJWT} from 'jose';
import {verifyIdentity} from './oidc';
import {NextRequest,NextResponse} from 'next/server';
import {db} from './db';
import {LEGAL_VERSION} from './legal';
export type Provider='google'|'github'|'apple';
const isProvider=(p:string):p is Provider=>['google','github','apple'].includes(p);
const sha=(s:string)=>createHash('sha256').update(s).digest('base64url');
const random=()=>randomBytes(32).toString('base64url');
const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const appleKeys=createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
export function oauthProviders(env:Record<string,string|undefined>){return {google:!!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET),github:!!(env.GITHUB_CLIENT_ID&&env.GITHUB_CLIENT_SECRET),apple:!!(env.APPLE_CLIENT_ID&&env.APPLE_TEAM_ID&&env.APPLE_KEY_ID&&env.APPLE_PRIVATE_KEY)};}
export function safeReturn(value:unknown){if(typeof value!=='string')return '/app';try{const url=new URL(value,'https://screenlink.invalid');if(url.origin!=='https://screenlink.invalid'||url.pathname!=='/app')return '/app';const room=url.searchParams.get('room');return room&&/^[a-f0-9]{24}$/.test(room)?`/app?room=${room}`:'/app';}catch{return '/app';}}
function origin(req:NextRequest){const url=new URL(process.env.AUTH_ORIGIN||process.env.APP_ORIGIN||req.nextUrl.origin);if(url.protocol!=='https:'&&!(process.env.NODE_ENV!=='production'&&['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('Origem OAuth inválida.');return url.origin;}
function failure(req:NextRequest,provider:string,code:string,returnTo='/app'){const url=new URL(safeReturn(returnTo),req.nextUrl.origin);url.searchParams.set('authError',code);const response=NextResponse.redirect(url,303);response.cookies.set(`oauth_${provider}`,'',{maxAge:0,path:`/api/oauth/${provider}`});return response;}
async function fetchJSON(url:string,init?:RequestInit){const response=await fetch(url,{...init,cache:'no-store',signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error('Provedor recusou a autenticação.');return response.json();}
export async function beginOAuth(req:NextRequest,name:string){
 if(!isProvider(name))return new Response('Provedor inválido.',{status:404});
 try{
  const base=origin(req);if(req.headers.get('origin')!==base)return new Response('Origem não autorizada.',{status:403});
  const form=await req.formData();if(form.get('terms')!==LEGAL_VERSION)return failure(req,name,'terms');
  const returnTo=safeReturn(form.get('returnTo'));if(!oauthProviders(process.env)[name])return failure(req,name,'unavailable',returnTo);
  if(name==='apple'&&!base.startsWith('https://'))return failure(req,name,'unavailable',returnTo);
  const database=await db();const now=Date.now();const clientId=process.env[`${name.toUpperCase()}_CLIENT_ID`]!;const state=random(),nonce=random(),verifier=random();
  const ip=req.headers.get('x-vercel-forwarded-for')||req.headers.get('x-forwarded-for')?.split(',')[0]||'local';const limit=await database.execute({sql:'INSERT INTO request_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',args:['oauth:'+sha(ip+Math.floor(now/60000)),now+120000]});if(Number(limit.rows[0].count)>20)return failure(req,name,'rate',returnTo);
  await database.batch([{sql:'DELETE FROM oauth_flows WHERE expires<?',args:[now]},{sql:'INSERT INTO oauth_flows VALUES(?,?,?,?,?,?,?)',args:[sha(state),name,nonce,verifier,returnTo,now+600000,LEGAL_VERSION]}],'write');
  const url=new URL(name==='google'?'https://accounts.google.com/o/oauth2/v2/auth':name==='github'?'https://github.com/login/oauth/authorize':'https://appleid.apple.com/auth/authorize');
  url.searchParams.set('client_id',clientId);url.searchParams.set('redirect_uri',`${base}/api/oauth/${name}/callback`);url.searchParams.set('response_type','code');url.searchParams.set('state',state);
  if(name==='apple'){url.searchParams.set('scope','name email');url.searchParams.set('response_mode','form_post');url.searchParams.set('nonce',nonce);}else{url.searchParams.set('code_challenge',sha(verifier));url.searchParams.set('code_challenge_method','S256');url.searchParams.set('scope',name==='google'?'openid profile email':'read:user');if(name==='google')url.searchParams.set('nonce',nonce);}
  const response=NextResponse.redirect(url,303);response.cookies.set(`oauth_${name}`,state,{httpOnly:true,secure:base.startsWith('https:'),sameSite:name==='apple'?'none':'lax',maxAge:600,path:`/api/oauth/${name}`});return response;
 }catch{return failure(req,name,'failed');}
}
export async function finishOAuth(req:NextRequest,name:string){
 if(!isProvider(name))return new Response('Provedor inválido.',{status:404});let returnTo='/app';
 try{
  const input=req.method==='POST'?await req.formData():req.nextUrl.searchParams;const state=input.get('state'),cookie=req.cookies.get(`oauth_${name}`)?.value;
  if(typeof state!=='string'||!cookie||state.length>128||state.length!==cookie.length||!timingSafeEqual(Buffer.from(state),Buffer.from(cookie)))return failure(req,name,'state');
  const database=await db();const result=await database.execute({sql:'DELETE FROM oauth_flows WHERE id=? AND provider=? AND expires>? RETURNING *',args:[sha(state),name,Date.now()]});const flow=result.rows[0];if(!flow||flow.legal_version!==LEGAL_VERSION)return failure(req,name,'state');returnTo=String(flow.return_to);
  if(input.get('error'))return failure(req,name,'cancelled',returnTo);const code=input.get('code');if(typeof code!=='string'||code.length>4096)throw new Error('Código inválido.');
  const base=origin(req),clientId=process.env[`${name.toUpperCase()}_CLIENT_ID`]!;let secret=process.env[`${name.toUpperCase()}_CLIENT_SECRET`]||'';
  if(name==='apple'){const key=await importPKCS8(process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g,'\n'),'ES256');secret=await new SignJWT({}).setProtectedHeader({alg:'ES256',kid:process.env.APPLE_KEY_ID!}).setIssuer(process.env.APPLE_TEAM_ID!).setSubject(clientId).setAudience('https://appleid.apple.com').setIssuedAt().setExpirationTime('5m').sign(key);}
  const body=new URLSearchParams({client_id:clientId,client_secret:secret,code,redirect_uri:`${base}/api/oauth/${name}/callback`,grant_type:'authorization_code'});if(name!=='apple')body.set('code_verifier',String(flow.verifier));
  const tokens=await fetchJSON(name==='google'?'https://oauth2.googleapis.com/token':name==='github'?'https://github.com/login/oauth/access_token':'https://appleid.apple.com/auth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body});
  let subject:string,displayName:string,email:string|null=null;
  if(name==='github'){
   if(typeof tokens.access_token!=='string')throw new Error('Token inválido.');const profile=await fetchJSON('https://api.github.com/user',{headers:{Authorization:`Bearer ${tokens.access_token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});if(!Number.isSafeInteger(profile.id)||typeof profile.login!=='string')throw new Error('Perfil inválido.');subject=String(profile.id);displayName=typeof profile.name==='string'&&profile.name.trim()?profile.name:profile.login;
  }else{
   if(typeof tokens.id_token!=='string')throw new Error('Token ausente.');const payload=await verifyIdentity(tokens.id_token,name==='google'?googleKeys:appleKeys,name==='google'?['https://accounts.google.com','accounts.google.com']:'https://appleid.apple.com',clientId,String(flow.nonce));
   if(payload.nonce!==flow.nonce||typeof payload.sub!=='string')throw new Error('Nonce inválido.');subject=payload.sub;email=(payload.email_verified===true||payload.email_verified==='true')&&typeof payload.email==='string'?payload.email:null;displayName=typeof payload.name==='string'?payload.name:name==='apple'?'Conta Apple':'Conta Google';
  }
  displayName=displayName.trim().slice(0,40)||'Participante';const candidate=randomUUID();
  // A conta é vinculada ao ID estável do provedor, nunca apenas a um e-mail recebido.
  await database.batch([
   {sql:'INSERT INTO users(id,name,email,password,guest) SELECT ?,?,NULL,NULL,0 WHERE NOT EXISTS(SELECT 1 FROM oauth_accounts WHERE provider=? AND subject=?)',args:[candidate,displayName,name,subject]},
   {sql:'INSERT OR IGNORE INTO oauth_accounts(provider,subject,user_id,email,created) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM users WHERE id=?)',args:[name,subject,candidate,email,Date.now(),candidate]},
  ],'write');
  const account=await database.execute({sql:'SELECT user_id FROM oauth_accounts WHERE provider=? AND subject=?',args:[name,subject]});const userId=String(account.rows[0].user_id);const session=randomBytes(32).toString('hex');const previous=req.cookies.get('session')?.value||'';
  await database.batch([{sql:'DELETE FROM connections WHERE session=?',args:[previous]},{sql:'DELETE FROM sessions WHERE token=? OR expires<?',args:[previous,Date.now()]},{sql:'INSERT INTO sessions VALUES(?,?,?)',args:[session,userId,Date.now()+604800000]},{sql:'INSERT INTO legal_acceptances VALUES(?,?,?) ON CONFLICT(user_id,version) DO UPDATE SET accepted=excluded.accepted',args:[userId,LEGAL_VERSION,Date.now()]}],'write');
  const response=NextResponse.redirect(new URL(safeReturn(returnTo),base),303);response.cookies.set(`oauth_${name}`,'',{maxAge:0,path:`/api/oauth/${name}`});response.cookies.set('session',session,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',maxAge:604800,path:'/'});return response;
 }catch{return failure(req,name,'failed',returnTo);}
}
