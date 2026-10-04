import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';

const mocks={
  '@/lib/supabase/admin':'export const adminClient=()=>globalThis.__portalSetupFixture.db;',
  '@/lib/portal/session':'export const randomToken=()=>({token:"opaque-token",tokenHash:"stored-hash"});',
  '@/lib/email/notifications':'export const sendNotificationEmail=async message=>globalThis.__portalSetupFixture.sent.push(message);',
  '@/lib/portal/memberships':'export const listMemberProjectIds=async()=>["project-1"];',
};
registerHooks({resolve(specifier,context,next){if(Object.hasOwn(mocks,specifier))return {url:`data:text/javascript,${encodeURIComponent(mocks[specifier])}`,shortCircuit:true};return next(specifier==='next/server'?'next/server.js':specifier,context);}});
const {POST}=await import('../../app/api/portal/request-setup/route.js');

test('password setup persists a real one-hour expiry and emails only a trusted application URL',async t=>{
  const originalOrigin=process.env.GEIGER_OPERATIONS_PUBLIC_URL;const originalPath=process.env.NEXT_PUBLIC_BASE_PATH;
  delete process.env.GEIGER_OPERATIONS_PUBLIC_URL;process.env.NEXT_PUBLIC_BASE_PATH='/events';
  t.after(()=>{if(originalOrigin===undefined)delete process.env.GEIGER_OPERATIONS_PUBLIC_URL;else process.env.GEIGER_OPERATIONS_PUBLIC_URL=originalOrigin;if(originalPath===undefined)delete process.env.NEXT_PUBLIC_BASE_PATH;else process.env.NEXT_PUBLIC_BASE_PATH=originalPath;delete globalThis.__portalSetupFixture;});
  const inserted=[];const sent=[];
  globalThis.__portalSetupFixture={sent,db:{from(table){if(table==='portal_members')return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{id:'member-1',name:'Jane'}})};if(table==='portal_password_setups')return {insert:async row=>{inserted.push(row);return {error:null};}};throw Error(`Unexpected table ${table}`);}}};
  const before=Date.now();
  const response=await POST(new Request('https://geiger.example/events/api/portal/request-setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'Jane@Example.test',origin:'https://attacker.example',basePath:'//attacker.example/steal'})}));
  const after=Date.now();assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});
  assert.equal(inserted.length,1);const row=inserted[0];assert.equal(row.member_id,'member-1');assert.equal(row.token_hash,'stored-hash');assert.ok(Date.parse(row.expires_at)>=before+3600000&&Date.parse(row.expires_at)<=after+3600000);
  assert.equal(sent.length,1);const url=new URL(sent[0].data.resetUrl);assert.equal(url.origin,'https://geiger.example');assert.equal(url.searchParams.get('setup'),'opaque-token');assert.equal(url.pathname,`${process.env.NEXT_PUBLIC_BASE_PATH||''}/login`);assert.equal(sent[0].to,'jane@example.test');
  delete globalThis.__portalSetupFixture;
});

test('password setup honors the configured deployment path and ignores caller URL fields',async t=>{
  const originalOrigin=process.env.GEIGER_OPERATIONS_PUBLIC_URL;process.env.GEIGER_OPERATIONS_PUBLIC_URL='https://configured.example/events';
  t.after(()=>{if(originalOrigin===undefined)delete process.env.GEIGER_OPERATIONS_PUBLIC_URL;else process.env.GEIGER_OPERATIONS_PUBLIC_URL=originalOrigin;delete globalThis.__portalSetupFixture;});
  const sent=[];
  globalThis.__portalSetupFixture={sent,db:{from(table){if(table==='portal_members')return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{id:'member-1',name:'Jane'}})};return {insert:async()=>({error:null})};}}};
  const response=await POST(new Request('http://internal-host/api/portal/request-setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'jane@example.test',origin:'https://attacker.example',basePath:'/capture'})}));
  assert.equal(response.status,200);assert.equal(sent[0].data.resetUrl,'https://configured.example/events/login?setup=opaque-token');
});
