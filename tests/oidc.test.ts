import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLocalJWKSet,exportJWK,generateKeyPair,SignJWT} from 'jose';
import {verifyIdentity} from '../lib/oidc';
test('identidade exige assinatura válida, emissor, audiência, validade e nonce da tentativa',async()=>{
 const keys=await generateKeyPair('RS256');const jwk=await exportJWK(keys.publicKey);const getKey=createLocalJWKSet({keys:[{...jwk,kid:'test',alg:'RS256'}]});
 const token=await new SignJWT({nonce:'nonce-original'}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://issuer.example').setAudience('screenlink').setSubject('provider-user-1').setIssuedAt().setExpirationTime('5m').sign(keys.privateKey);
 assert.equal((await verifyIdentity(token,getKey,'https://issuer.example','screenlink','nonce-original')).sub,'provider-user-1');
 await assert.rejects(()=>verifyIdentity(token,getKey,'https://issuer.example','screenlink','nonce-forjado'));
 await assert.rejects(()=>verifyIdentity(token,getKey,'https://issuer.example','outro-app','nonce-original'));
 await assert.rejects(()=>verifyIdentity(token,getKey,'https://outro-emissor.example','screenlink','nonce-original'));
 const expired=await new SignJWT({nonce:'nonce-original'}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://issuer.example').setAudience('screenlink').setSubject('provider-user-1').setIssuedAt(Math.floor(Date.now()/1000)-120).setExpirationTime(Math.floor(Date.now()/1000)-60).sign(keys.privateKey);await assert.rejects(()=>verifyIdentity(expired,getKey,'https://issuer.example','screenlink','nonce-original'));
 const other=await generateKeyPair('RS256');const invalid=await new SignJWT({nonce:'nonce-original'}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://issuer.example').setAudience('screenlink').setSubject('impostor').setIssuedAt().setExpirationTime('5m').sign(other.privateKey);await assert.rejects(()=>verifyIdentity(invalid,getKey,'https://issuer.example','screenlink','nonce-original'));
});
