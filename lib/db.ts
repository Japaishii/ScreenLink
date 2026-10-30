import {createClient, type Client} from '@libsql/client';
import {mkdirSync} from 'node:fs';
let database:Client|undefined;
let schema:Promise<unknown>|undefined;
export async function db(){
 if(!database){
  let url=process.env.TURSO_DATABASE_URL;
  if(!url){if(process.env.VERCEL)throw new Error('Configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN na Vercel.');mkdirSync(process.env.DATA_DIR||'data',{recursive:true});url=`file:${process.env.DATA_DIR||'data'}/screenlink.sqlite`;}
  if(process.env.VERCEL&&(!url.startsWith('libsql://')&&!url.startsWith('https://')))throw new Error('Na Vercel, configure um banco libSQL remoto.');
  database=createClient({url,authToken:process.env.TURSO_AUTH_TOKEN});
 }
 if(!schema){schema=database.batch([
  `CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE,password TEXT,guest INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL,private INTEGER NOT NULL,password TEXT,owner TEXT NOT NULL REFERENCES users(id),created INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS access(room_id TEXT REFERENCES rooms(id),user_id TEXT REFERENCES users(id),PRIMARY KEY(room_id,user_id))`,
  `CREATE TABLE IF NOT EXISTS connections(id TEXT PRIMARY KEY,room_id TEXT NOT NULL,user_id TEXT NOT NULL,session TEXT NOT NULL,sharing INTEGER NOT NULL DEFAULT 0,seen INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS connections_room_seen ON connections(room_id,seen)`,
  `CREATE TABLE IF NOT EXISTS signals(id INTEGER PRIMARY KEY AUTOINCREMENT,room_id TEXT NOT NULL,sender TEXT NOT NULL,recipient TEXT NOT NULL,payload TEXT NOT NULL,created INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS signals_recipient ON signals(recipient,id)`,
  `CREATE INDEX IF NOT EXISTS signals_created ON signals(created)`,
  `CREATE TABLE IF NOT EXISTS request_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL)`,
 ],'write').catch(e=>{schema=undefined;throw e;});}
 await schema;return database;
}
