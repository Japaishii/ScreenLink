import {oauthProviders} from '../../../../lib/oauth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(){return Response.json(oauthProviders(process.env),{headers:{'Cache-Control':'no-store'}});}
