import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('APIs Next.js: login, senha privada e sinalização isolada no banco', {timeout:120000},async()=>{
 const port=String(14000+Math.floor(Math.random()*20000));const base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next',process.env.SCREENLINK_TEST_PRODUCTION==='1'?'start':'dev','--hostname','127.0.0.1','--port',port],{env:{...process.env,VERCEL:'',TURSO_DATABASE_URL:'',TURSO_AUTH_TOKEN:'',APP_ORIGIN:base,DATA_DIR:mkdtempSync(join(tmpdir(),'screenlink-test-'))},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
 try{
  let ready=false;for(let i=0;i<150;i++){try{if((await fetch(base+'/api/me')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,300));}assert.ok(ready,logs);
  async function request(path:string,body?:unknown,cookie=''){const res=await fetch(base+'/api'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookie,Origin:base},body:body===undefined?undefined:JSON.stringify(body)});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]||''};}
  assert.equal((await fetch(base+'/healthz')).status,200);assert.equal((await request('/rooms')).status,401);
  const forged=await fetch(base+'/api/auth/guest',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://outro-site.example'},body:JSON.stringify({name:'Origem incorreta'})});assert.equal(forged.status,403);
  assert.equal((await fetch(base+'/api/me')).headers.get('cache-control'),'no-store');
  const owner=await request('/auth/register',{name:'Criador',email:'owner@example.com',password:'senha-segura-123'});assert.equal(owner.status,200);
  assert.equal((await request('/auth/login',{email:'owner@example.com',password:'incorreta'})).status,401);
  const login=await request('/auth/login',{email:'owner@example.com',password:'senha-segura-123'});assert.equal(login.status,200);
  const guest=await request('/auth/guest',{name:'Visitante'});assert.equal(guest.status,200);
  const created=await request('/rooms',{name:'Sala privada',description:'Teste',private:true,password:'segredo123'},login.cookie);assert.equal(created.status,200);const id=created.data.id;
  const pub=await request('/rooms',{name:'Sala pública',description:'Aberta',private:false},login.cookie);assert.equal(pub.status,200);
  const listed=await request('/rooms',undefined,guest.cookie);assert.ok(!listed.data.rooms.some((r:{id:string})=>r.id===id));assert.ok(listed.data.rooms.some((r:{id:string})=>r.id===pub.data.id));
  assert.equal((await request('/rooms/'+id,undefined,guest.cookie)).data.room.locked,true);
  assert.equal((await request('/realtime/connect',{room:id},guest.cookie)).status,403);
  assert.equal((await request('/rooms/'+id+'/join',{password:'errada'},guest.cookie)).status,403);
  assert.equal((await request('/rooms/'+id+'/join',{password:'segredo123'},guest.cookie)).status,200);
  const visitor=await request('/realtime/connect',{room:id},guest.cookie);assert.equal(visitor.status,200);const visitorId=visitor.data.id;
  const ownerConnection=await request('/realtime/connect',{room:id},login.cookie);const ownerId=ownerConnection.data.id;
  const other=await request('/realtime/connect',{room:pub.data.id},login.cookie);
  assert.equal((await request('/realtime/signal',{id:visitorId,to:other.data.id,signal:{type:'offer'}},guest.cookie)).status,403);
  assert.equal((await request('/realtime/poll',{id:visitorId},login.cookie)).status,410);
  assert.equal((await request('/realtime/signal',{id:visitorId,to:ownerId,signal:{type:'candidate',candidate:{candidate:'test'}}},guest.cookie)).status,200);
  const polled=await request('/realtime/poll',{id:ownerId,sharing:true},login.cookie);assert.equal(polled.status,200);assert.equal(polled.data.participants.length,2);assert.equal(polled.data.messages[0].from,visitorId);
  const next=await request('/realtime/poll',{id:ownerId,cursor:polled.data.cursor},login.cookie);assert.equal(next.data.messages.length,0);
  await request('/logout',{},guest.cookie);assert.equal((await request('/rooms',undefined,guest.cookie)).status,401);
  const after=await request('/realtime/poll',{id:ownerId},login.cookie);assert.equal(after.data.participants.length,1);
 }finally{child.kill();}
});
