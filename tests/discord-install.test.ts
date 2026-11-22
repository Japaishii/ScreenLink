import {test} from 'node:test';
import assert from 'node:assert/strict';
import {discordInstallUrl} from '../lib/discord-install';
test('convite Discord usa host oficial, somente escopo bot e permissões mínimas',()=>{
 const result=new URL(discordInstallUrl('123456789012345678')!);
 assert.equal(result.origin,'https://discord.com');assert.equal(result.pathname,'/oauth2/authorize');
 assert.equal(result.searchParams.get('client_id'),'123456789012345678');assert.equal(result.searchParams.get('scope'),'bot');
 assert.equal(result.searchParams.get('permissions'),'19456');assert.equal(Number(result.searchParams.get('permissions'))&8,0);
 for(const id of ['', '123', 'https://evil.example', '123456789012345678&scope=identify'])assert.equal(discordInstallUrl(id),null);
});
