import {NextRequest} from 'next/server';
import {finishOAuth} from '../../../../../lib/oauth';
export const runtime='nodejs';
export async function GET(req:NextRequest,{params}:{params:Promise<{provider:string}>}){return finishOAuth(req,(await params).provider);}
export const POST=GET;
