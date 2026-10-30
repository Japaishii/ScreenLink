import { createHmac } from 'node:crypto';

export function iceServers(env: Record<string,string|undefined>, userId: string, now = Date.now()) {
 const servers: {urls:string|string[];username?:string;credential?:string}[]=[{urls:'stun:stun.l.google.com:19302'}];
 const urls=env.TURN_URL?.split(',').map(url=>url.trim()).filter(Boolean);
 if(!urls?.length)return servers;
 if(env.TURN_SECRET){
  // Coturn TURN REST API: o segredo compartilhado nunca é enviado ao navegador.
  const username=`${Math.floor(now/1000)+86400}:${userId}`;
  const credential=createHmac('sha1',env.TURN_SECRET).update(username).digest('base64');
  servers.push({urls,username,credential});
 }else if(env.TURN_USERNAME&&env.TURN_PASSWORD){servers.push({urls,username:env.TURN_USERNAME,credential:env.TURN_PASSWORD});}
 return servers;
}
