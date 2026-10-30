import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword,verifyPassword } from '../lib/security';
test('senhas usam salt único e rejeitam credenciais incorretas',()=>{const a=hashPassword('minha-senha-segura');const b=hashPassword('minha-senha-segura');assert.notEqual(a,b);assert.ok(verifyPassword('minha-senha-segura',a));assert.equal(verifyPassword('outra-senha',a),false);});
