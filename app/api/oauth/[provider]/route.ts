import {NextRequest} from 'next/server';
import {beginOAuth} from '../../../../lib/oauth';
export const runtime='nodejs';
export async function POST(req:NextRequest,{params}:{params:Promise<{provider:string}>}){return beginOAuth(req,(await params).provider);}
