import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/lib/auth.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {safeAuthReturn,isGoogleMember,authOrigin}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
test('OAuth returns allow only internal application pages, removing authorization data',()=>{
  for(const unsafe of ['https://evil.test','//evil.test','/\\evil.test','/auth/callback','/api/test','/korea\n','/me/events/../../auth/callback','/%2f%2fevil.test',null]) assert.equal(safeAuthReturn(unsafe),'/me/events');
  assert.equal(safeAuthReturn('/korea?event=abc&lang=en&code=secret&error=x&error_description=secret'),'/korea?event=abc&lang=en');
  assert.equal(safeAuthReturn('/me/events/abc'),'/me/events/abc');
});
test('OAuth redirect origins ignore public Host spoofing and permit explicit local development',()=>{
  assert.equal(authOrigin('https://festiva.test','evil.test',true),'https://festiva.test');
  assert.equal(authOrigin('https://festiva.test','localhost:3011',true),'http://localhost:3011');
  assert.equal(authOrigin('https://festiva.test','localhost:3011',false),'https://festiva.test');
  assert.equal(authOrigin('https://festiva.test','localhost.evil.test',true),'https://festiva.test');
});
test('OAuth callback accepts only a verified non-anonymous Google membership',()=>{
  assert.equal(isGoogleMember(null),false);
  assert.equal(isGoogleMember({is_anonymous:true,app_metadata:{providers:['google']}}),false);
  assert.equal(isGoogleMember({is_anonymous:false,app_metadata:{provider:'email'}}),false);
  assert.equal(isGoogleMember({is_anonymous:false,app_metadata:{providers:['google']}}),true);
});
