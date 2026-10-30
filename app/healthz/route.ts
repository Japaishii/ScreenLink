import {db} from '../../lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){try{await(await db()).execute('SELECT 1');return Response.json({status:'ok'},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({status:'unavailable'},{status:503});}}
