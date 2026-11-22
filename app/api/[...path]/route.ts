import {NextRequest,NextResponse} from 'next/server';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {db} from '../../../lib/db';
import {hashPassword,verifyPassword} from '../../../lib/security';
import {iceServers} from '../../../lib/ice';
import {roomRegions} from '../../../lib/room-regions';
import {LEGAL_VERSION} from '../../../lib/legal';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
type User={id:string;name:string;guest:number;password?:string};
type Room={id:string;name:string;description:string;private:number;password?:string;owner:string};
class ApiError extends Error{constructor(public status:number,message:string){super(message);}}
function fail(status:number,message:string):never{throw new ApiError(status,message);}
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
function text(value:unknown,min:number,max:number){return typeof value==='string'&&value.trim().length>=min&&value.length<=max;}
async function handle(req:NextRequest){
 try{
  const path=req.nextUrl.pathname.slice(5).split('/');const post=req.method==='POST';
  if(post){const origin=req.headers.get('origin');const expected=process.env.APP_ORIGIN||req.nextUrl.origin;if(origin&&origin!==new URL(expected).origin)fail(403,'Origem não autorizada.');if(Number(req.headers.get('content-length')||0)>65536)fail(413,'Requisição muito grande.');}
  const database=await db();const now=Date.now();const session=req.cookies.get('session')?.value||'';
  const run=async(sql:string,args:(string|number|null)[]=[])=>database.execute({sql,args});
  const one=async<T,>(sql:string,args:(string|number|null)[]=[])=> (await run(sql,args)).rows[0] as unknown as T|undefined;
  // Contador compartilhado por todas as instâncias serverless.
  const ip=req.headers.get('x-vercel-forwarded-for')||req.headers.get('x-forwarded-for')?.split(',')[0]||'local';
  const key=createHash('sha256').update((path[0]==='auth'?'auth:':'api:')+ip+':'+Math.floor(now/60000)).digest('hex');
  const limit=await one<{count:number}>('INSERT INTO request_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',[key,now+120000]);
  if(Number(limit!.count)>(path[0]==='auth'?25:600))fail(429,'Muitas tentativas. Aguarde um minuto.');
  const user=await one<User>('SELECT users.* FROM users JOIN sessions ON users.id=sessions.user_id WHERE token=? AND expires>?',[session,now]);
  let body:Record<string,unknown>={};if(post){const raw=await req.text();if(raw.length>65536)fail(413,'Requisição muito grande.');try{body=JSON.parse(raw||'{}');}catch{fail(400,'JSON inválido.');}if(!body||Array.isArray(body)||typeof body!=='object')fail(400,'Requisição inválida.');}
  if(path[0]==='me'&&!post)return json({user:user?{id:user.id,name:user.name,guest:!!user.guest}:null});
  if(path[0]==='auth'&&post){
   if(path[1]!=='guest')fail(410,'Use Google, GitHub ou Apple para entrar com uma conta.');
   const {name,terms}=body;if(!text(name,2,40))fail(400,'Use um nome entre 2 e 40 caracteres.');
   if(terms!==LEGAL_VERSION)fail(400,'Leia e aceite os Termos de Uso para continuar.');
   const account={id:randomUUID(),name:(name as string).trim()};const token=randomBytes(32).toString('hex');
   await database.batch([
    {sql:'INSERT INTO users(id,name,email,password,guest) VALUES(?,?,NULL,NULL,1)',args:[account.id,account.name]},
    {sql:'DELETE FROM sessions WHERE token=?',args:[session]},
    {sql:'DELETE FROM connections WHERE session=?',args:[session]},
    {sql:'INSERT INTO sessions VALUES(?,?,?)',args:[token,account.id,now+604800000]},
    {sql:'INSERT INTO legal_acceptances VALUES(?,?,?)',args:[account.id,LEGAL_VERSION,now]},
   ],'write');
   const response=json({user:{...account,guest:true}});response.cookies.set('session',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:604800,path:'/'});return response;
  }
  if(path[0]==='logout'&&post){await database.batch([{sql:'DELETE FROM sessions WHERE token=?',args:[session]},{sql:'DELETE FROM connections WHERE session=?',args:[session]}],'write');const response=json({ok:true});response.cookies.set('session','',{maxAge:0,path:'/'});return response;}
  if(path.length===1&&path[0]==='discover'&&!post){
   const rows=await run(`SELECT r.id,r.name,r.description,g.region,
     (SELECT COUNT(*) FROM connections c WHERE c.room_id=r.id AND c.seen>?) AS online
     FROM rooms r LEFT JOIN room_regions g ON g.room_id=r.id
     WHERE r.private=0 ORDER BY online DESC,r.created DESC`,[now-25000]);
   return json({rooms:rows.rows});
  }
  if(!user)fail(401,'Entre na sua conta ou como convidado.');
  async function roomById(id:string){const room=await one<Room>('SELECT * FROM rooms WHERE id=?',[id]);if(!room)fail(404,'Servidor não encontrado.');return room;}
  async function allowed(room:Room){return !room.private||room.owner===user!.id||!!await one('SELECT 1 FROM access WHERE room_id=? AND user_id=?',[room.id,user!.id]);}
  async function sendChat(roomId:string){
   if(!text(body.text,1,2000)||!text(body.clientId,8,80))fail(400,'Envie uma mensagem entre 1 e 2000 caracteres.');
   const recent=await one<{count:number}>('SELECT COUNT(*) AS count FROM chat_messages WHERE user_id=? AND created>?',[user!.id,now-10000]);
   if(Number(recent?.count)>7)fail(429,'Aguarde alguns segundos antes de enviar outra mensagem.');
   await run('INSERT OR IGNORE INTO chat_messages(room_id,user_id,body,created,client_id) VALUES(?,?,?,?,?)',[roomId,user!.id,(body.text as string).trim(),now,body.clientId as string]);return json({ok:true});
  }
  if(path[0]==='ice'&&!post)return json({iceServers:iceServers(process.env,user.id)});
  if(path[0]==='rooms'){
   if(path.length===1&&!post){
    await database.batch([{sql:'DELETE FROM signals WHERE created<?',args:[now-120000]},{sql:'DELETE FROM connections WHERE seen<?',args:[now-120000]},{sql:'DELETE FROM connection_media WHERE connection_id NOT IN (SELECT id FROM connections)',args:[]},{sql:'DELETE FROM sessions WHERE expires<?',args:[now]},{sql:'DELETE FROM request_limits WHERE expires<?',args:[now]}],'write');
    const rows=await run(`SELECT r.id,r.name,r.description,r.private,r.owner,u.name AS ownerName,(SELECT COUNT(*) FROM connections c WHERE c.room_id=r.id AND c.seen>?) AS online,(SELECT COUNT(*) FROM connections c WHERE c.room_id=r.id AND c.seen>? AND c.sharing=1) AS streaming FROM rooms r JOIN users u ON u.id=r.owner WHERE r.private=0 OR r.owner=? ORDER BY r.created DESC`,[now-25000,now-25000,user.id]);const members=await run('SELECT c.room_id,u.name FROM connections c JOIN users u ON u.id=c.user_id JOIN rooms r ON r.id=c.room_id WHERE c.seen>? AND (r.private=0 OR r.owner=?) ORDER BY c.seen DESC',[now-25000,user.id]);return json({rooms:rows.rows.map(r=>({...r,participants:members.rows.filter(m=>m.room_id===r.id).slice(0,4).map(m=>({name:m.name}))}))});
   }
   if(path.length===1&&post){const {name,description='',private:privateRoom,password,region=''}=body;if(!text(name,2,60)||typeof description!=='string'||description.length>180||typeof privateRoom!=='boolean'||(privateRoom&&!text(password,6,128)))fail(400,'Nome: 2 a 60 caracteres. Descrição: até 180. Senha privada: 6 a 128.');const id=randomBytes(12).toString('hex');if(region!==''&&(privateRoom||!roomRegions.some(option=>option.id===region)))fail(400,'Selecione uma região válida para a sala pública.');
    await database.batch([
     {sql:'INSERT INTO rooms(id,name,description,private,password,owner,created) VALUES(?,?,?,?,?,?,?)',args:[id,(name as string).trim(),description,privateRoom?1:0,privateRoom?hashPassword(password as string):null,user.id,now]},
     ...(typeof region==='string'&&region?[{sql:'INSERT INTO room_regions(room_id,region) VALUES(?,?)',args:[id,region]}]:[]),
    ],'write');return json({id});}
   const room=await roomById(path[1]);
   if(path[2]==='lobby'&&!post){
    if(!await allowed(room))fail(403,'Informe a senha para visualizar esta sala.');
    const cursor=Number(req.nextUrl.searchParams.get('cursor')||0);if(!Number.isSafeInteger(cursor)||cursor<0)fail(400,'Cursor inválido.');
    const result=await database.batch([
     {sql:'SELECT c.id,u.name,c.sharing,COALESCE(m.camera,0) AS camera,COALESCE(m.microphone,0) AS microphone FROM connections c JOIN users u ON u.id=c.user_id LEFT JOIN connection_media m ON m.connection_id=c.id WHERE c.room_id=? AND c.seen>? ORDER BY c.id',args:[room.id,now-25000]},
     {sql:cursor?'SELECT m.id,m.user_id AS userId,u.name,m.body AS text,m.created,m.client_id AS clientId FROM chat_messages m JOIN users u ON u.id=m.user_id WHERE m.room_id=? AND m.id>? ORDER BY m.id LIMIT 100':'SELECT * FROM (SELECT m.id,m.user_id AS userId,u.name,m.body AS text,m.created,m.client_id AS clientId FROM chat_messages m JOIN users u ON u.id=m.user_id WHERE m.room_id=? AND m.id>? ORDER BY m.id DESC LIMIT 100) ORDER BY id',args:[room.id,cursor]},
    ],'read');
    const chat=result[1].rows;return json({participants:result[0].rows.map(p=>({...p,sharing:!!p.sharing,camera:!!p.camera,microphone:!!p.microphone})),chat,cursor:chat.length?Number(chat[chat.length-1].id):cursor});
   }
   if(path[2]==='chat'&&post){if(!await allowed(room))fail(403,'Acesso não autorizado.');return await sendChat(room.id);}
   if(path.length===2&&!post){const {password:_,...safe}=room;return json({room:{...safe,locked:!await allowed(room)}});}
   if(path[2]==='join'&&post){if(!await allowed(room)){if(typeof body.password!=='string'||body.password.length>128||!verifyPassword(body.password,room.password!))fail(403,'Senha do servidor incorreta.');await run('INSERT OR IGNORE INTO access VALUES(?,?)',[room.id,user.id]);}return json({ok:true});}
  }
  if(path[0]==='realtime'&&post){
   if(path[1]==='connect'){
    if(typeof body.room!=='string')fail(400,'Servidor inválido.');const room=await roomById(body.room);if(!await allowed(room))fail(403,'Acesso não autorizado.');
    const id=randomBytes(24).toString('hex');await run('INSERT INTO connections(id,room_id,user_id,session,seen) VALUES(?,?,?,?,?)',[id,room.id,user.id,session,now]);return json({id});
   }
   if(typeof body.id!=='string')fail(400,'Conexão inválida.');
   const connection=await one<{id:string;room_id:string;seen:number}>('SELECT * FROM connections WHERE id=? AND user_id=? AND session=?',[body.id,user.id,session]);
   if(!connection)fail(410,'Conexão encerrada. Entre novamente no servidor.');
   if(path[1]==='leave'){await run('DELETE FROM connections WHERE id=?',[connection.id]);return json({ok:true});}
   if(connection.seen<now-25000)fail(410,'A conexão expirou. Reconectando…');
   if(path[1]==='chat'){
    return await sendChat(connection.room_id);
   }
   if(path[1]==='poll'){
    if(connection.seen<now-25000)fail(410,'A conexão expirou. Reconectando…');
    const cursor=Number(body.cursor||0);if(!Number.isSafeInteger(cursor)||cursor<0)fail(400,'Cursor inválido.');
    const chatCursor=Number(body.chatCursor||0);if(!Number.isSafeInteger(chatCursor)||chatCursor<0)fail(400,'Cursor de chat inválido.');
    const result=await database.batch([
     {sql:'UPDATE connections SET seen=?,sharing=? WHERE id=?',args:[now,body.sharing===true?1:0,connection.id]},
     {sql:'INSERT INTO connection_media VALUES(?,?,?) ON CONFLICT(connection_id) DO UPDATE SET camera=excluded.camera,microphone=excluded.microphone',args:[connection.id,body.camera===true?1:0,body.microphone===true?1:0]},
     {sql:'SELECT c.id,u.name,c.sharing,COALESCE(m.camera,0) AS camera,COALESCE(m.microphone,0) AS microphone FROM connections c JOIN users u ON u.id=c.user_id LEFT JOIN connection_media m ON m.connection_id=c.id WHERE c.room_id=? AND c.seen>? ORDER BY c.id',args:[connection.room_id,now-25000]},
     {sql:'SELECT id,sender,payload FROM signals WHERE recipient=? AND id>? AND created>? ORDER BY id LIMIT 200',args:[connection.id,cursor,now-120000]},
     {sql:'DELETE FROM signals WHERE recipient=? AND id<=?',args:[connection.id,cursor]},
     {sql:chatCursor?'SELECT m.id,m.user_id AS userId,u.name,m.body AS text,m.created,m.client_id AS clientId FROM chat_messages m JOIN users u ON u.id=m.user_id WHERE m.room_id=? AND m.id>? ORDER BY m.id LIMIT 100':'SELECT * FROM (SELECT m.id,m.user_id AS userId,u.name,m.body AS text,m.created,m.client_id AS clientId FROM chat_messages m JOIN users u ON u.id=m.user_id WHERE m.room_id=? AND m.id>? ORDER BY m.id DESC LIMIT 100) ORDER BY id',args:[connection.room_id,chatCursor]},
    ],'write');
    const messages=result[3].rows;const chat=result[5].rows;return json({participants:result[2].rows.map(p=>({...p,sharing:!!p.sharing,camera:!!p.camera,microphone:!!p.microphone})),messages:messages.map(m=>({from:m.sender,signal:JSON.parse(String(m.payload))})),cursor:messages.length?Number(messages[messages.length-1].id):cursor,chat,chatCursor:chat.length?Number(chat[chat.length-1].id):chatCursor});
   }
   if(path[1]==='signal'){
    const {to,signal}=body;if(typeof to!=='string'||!signal||typeof signal!=='object'||!['offer','answer','candidate'].includes(String((signal as {type?:unknown}).type)))fail(400,'Sinal inválido.');
    const target=await one('SELECT 1 FROM connections WHERE id=? AND room_id=? AND seen>?',[to,connection.room_id,now-25000]);if(!target)fail(403,'Participante indisponível.');
    await run('INSERT INTO signals(room_id,sender,recipient,payload,created) VALUES(?,?,?,?,?)',[connection.room_id,connection.id,to,JSON.stringify(signal),now]);return json({ok:true});
   }
  }
  fail(404,'Rota não encontrada.');
 }catch(e){if(e instanceof ApiError)return json({error:e.message},e.status);console.error('Falha na API:',e instanceof Error?e.name:'erro');return json({error:'Serviço indisponível. Verifique a configuração do banco e tente novamente.'},503);}
}
export const GET=handle;
export const POST=handle;
