import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {iceServers} from '../lib/ice';
test('TURN emite credenciais temporárias compatíveis com Coturn sem expor o segredo',()=>{
 const env={TURN_URL:'turn:203.0.113.10:3478?transport=udp,turn:203.0.113.10:3478?transport=tcp',TURN_SECRET:'segredo-apenas-no-servidor'};
 const result=iceServers(env,'usuario-123',1000000);const turn=result[1];
 assert.deepEqual(turn.urls,env.TURN_URL.split(','));
 assert.equal(turn.username,'87400:usuario-123');
 assert.equal(turn.credential,createHmac('sha1',env.TURN_SECRET).update(turn.username!).digest('base64'));
 assert.ok(!JSON.stringify(result).includes(env.TURN_SECRET));
 assert.equal(iceServers({},'id').length,1);
});
