import {jwtVerify,type JWTVerifyGetKey} from 'jose';
export async function verifyIdentity(token:string,keys:JWTVerifyGetKey,issuer:string|string[],audience:string,nonce:string){
 const {payload}=await jwtVerify(token,keys,{issuer,audience,algorithms:['RS256'],requiredClaims:['sub','exp','iat','nonce'],maxTokenAge:'10m',clockTolerance:5});
 if(payload.nonce!==nonce||typeof payload.sub!=='string'||!payload.sub)throw new Error('Identidade não corresponde à tentativa de acesso.');
 return payload;
}
