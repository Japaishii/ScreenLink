import {NextRequest,NextResponse} from 'next/server';
import {db} from '../../../../lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function handle(req:NextRequest,{params}:{params:Promise<{action:string}>}){
 try{
  const action=(await params).action;if(!['export','delete'].includes(action))return json({error:'Ação inválida.'},404);
  if((action==='export'&&req.method!=='GET')||(action==='delete'&&req.method!=='POST'))return json({error:'Método inválido.'},405);
  const database=await db();const token=req.cookies.get('session')?.value||'';const result=await database.execute({sql:'SELECT u.id,u.name,u.guest FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?',args:[token,Date.now()]});const user=result.rows[0];if(!user)return json({error:'Entre na sua conta para acessar seus dados.'},401);const id=String(user.id);
  if(action==='export'){
   const values=await database.batch([
    {sql:'SELECT provider,subject,email,created FROM oauth_accounts WHERE user_id=?',args:[id]},
    {sql:'SELECT r.id,r.name,r.description,r.private,r.created,g.region FROM rooms r LEFT JOIN room_regions g ON r.id=g.room_id WHERE r.owner=?',args:[id]},
    {sql:'SELECT id,room_id,body,created FROM chat_messages WHERE user_id=? ORDER BY id',args:[id]},
    {sql:'SELECT version,accepted FROM legal_acceptances WHERE user_id=?',args:[id]},
   ],'read');const response=json({exportedAt:new Date().toISOString(),user,identities:values[0].rows,rooms:values[1].rows,messages:values[2].rows,terms:values[3].rows});response.headers.set('Content-Disposition','attachment; filename="screenlink-meus-dados.json"');return response;
  }
  const expected=process.env.APP_ORIGIN||req.nextUrl.origin;if(req.headers.get('origin')!==new URL(expected).origin)return json({error:'Origem não autorizada.'},403);
  if(Number(req.headers.get('content-length')||0)>1024)return json({error:'Requisição inválida.'},400);let body;try{body=await req.json();}catch{return json({error:'Requisição inválida.'},400);}if(body?.confirmation!=='EXCLUIR')return json({error:'Digite EXCLUIR para confirmar.'},400);
  await database.batch([
   {sql:'DELETE FROM signals WHERE room_id IN (SELECT id FROM rooms WHERE owner=?) OR sender IN (SELECT id FROM connections WHERE user_id=?) OR recipient IN (SELECT id FROM connections WHERE user_id=?)',args:[id,id,id]},
   {sql:'DELETE FROM connection_media WHERE connection_id IN (SELECT c.id FROM connections c WHERE c.user_id=? OR c.room_id IN (SELECT id FROM rooms WHERE owner=?))',args:[id,id]},
   {sql:'DELETE FROM connections WHERE user_id=? OR room_id IN (SELECT id FROM rooms WHERE owner=?)',args:[id,id]},
   {sql:'DELETE FROM chat_messages WHERE user_id=? OR room_id IN (SELECT id FROM rooms WHERE owner=?)',args:[id,id]},
   {sql:'DELETE FROM access WHERE user_id=? OR room_id IN (SELECT id FROM rooms WHERE owner=?)',args:[id,id]},
   {sql:'DELETE FROM room_regions WHERE room_id IN (SELECT id FROM rooms WHERE owner=?)',args:[id]},
   {sql:'DELETE FROM rooms WHERE owner=?',args:[id]},
   {sql:'DELETE FROM oauth_accounts WHERE user_id=?',args:[id]},
   {sql:'DELETE FROM legal_acceptances WHERE user_id=?',args:[id]},
   {sql:'DELETE FROM sessions WHERE user_id=?',args:[id]},
   {sql:'DELETE FROM users WHERE id=?',args:[id]},
  ],'write');const response=json({ok:true});response.cookies.set('session','',{maxAge:0,path:'/'});return response;
 }catch{return json({error:'Não foi possível concluir a operação. Tente novamente.'},503);}
}
export const GET=handle;
export const POST=handle;
