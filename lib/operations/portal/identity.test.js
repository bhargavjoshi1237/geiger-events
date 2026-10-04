import test from 'node:test';
import assert from 'node:assert/strict';
const {registerInvitationAccount,resolvePortalPrincipal,acceptPortalInvitation}=await import('./identity.js').catch(()=>({}));
const eventId='11111111-1111-4111-8111-111111111111';
const memberId='22222222-2222-4222-8222-222222222222';
const commandId='33333333-3333-4333-8333-333333333333';
const input={eventId,token:'a'.repeat(43),email:'person@example.test',name:'Person',password:'strong-password-123'};
function boundary(overrides={}) {return {loadInvitation:async()=>({email:input.email,expiresAt:'2099-01-01T00:00:00Z',acceptedAt:null,revokedAt:null}),findMember:async()=>null,createMember:async()=>({id:memberId}),createSession:async()=>{},...overrides};}
test('portal principal requires a verified existing session and ignores caller identity',async()=>{
  assert.equal(typeof resolvePortalPrincipal,'function');
  await assert.rejects(resolvePortalPrincipal({getMember:async()=>null}),{status:401});
  assert.deepEqual(await resolvePortalPrincipal({getMember:async()=>({id:memberId,email:input.email})}),{kind:'portal',id:memberId,email:input.email});
});
test('invitation scoped registration needs valid unexpired matching capability',async()=>{
  for(const invitation of [null,{email:'other@example.test',expiresAt:'2099-01-01T00:00:00Z'},{email:input.email,expiresAt:'2020-01-01T00:00:00Z'},{email:input.email,expiresAt:'2099-01-01T00:00:00Z',revokedAt:'2026-01-01'},{email:input.email,expiresAt:'2099-01-01T00:00:00Z',acceptedAt:'2026-01-01'}])await assert.rejects(registerInvitationAccount(input,boundary({loadInvitation:async()=>invitation})),{status:403});
  await assert.rejects(registerInvitationAccount({...input,principalId:memberId},boundary()),{status:422});
});
test('invitation registration does not overwrite existing accounts; new account has hashed password and verified session',async()=>{
  await assert.rejects(registerInvitationAccount(input,boundary({findMember:async()=>({id:memberId})})),{code:'existing_account',status:409});
  let saved;const response=await registerInvitationAccount(input,boundary({createMember:async row=>{saved=row;return {id:memberId};}}));
  assert.equal(response.memberId,memberId);assert.match(saved.passwordHash,/^scrypt\$/);assert.equal(saved.password,undefined);assert.match(response.sessionToken,/^[A-Za-z0-9_-]{43}$/);
});
test('acceptance derives token hash and verified email instead of accepting caller claims',async()=>{
  let saved;const principal={kind:'portal',id:memberId,email:input.email};
  const context={projectId:eventId,eventId,principal};
  const store={snapshot:async()=>({revision:7,enabled:true}),mutate:async(_context,command)=>{saved=command;return {revision:8,result:{personId:memberId}};}};
  assert.equal((await acceptPortalInvitation(context,{token:input.token,commandId},store)).revision,8);
  assert.equal(saved.expectedRevision,7);assert.equal(saved.principalEmail,input.email);assert.match(saved.tokenHash,/^[a-f0-9]{64}$/);assert.equal(saved.token,undefined);
  await assert.rejects(acceptPortalInvitation(context,{token:input.token,commandId,principalEmail:'attacker@example.test'},store),{status:422});
});
test('acceptance uncertain retry keeps logical request hash even when server chooses a newer revision',async()=>{
  const context={projectId:eventId,eventId,principal:{kind:'portal',id:memberId,email:input.email}};
  const hashes=[];let revision=0;const store={snapshot:async()=>({revision,enabled:true}),mutate:async(_ctx,command)=>{hashes.push(command.requestHash);revision++;return {revision,result:{id:memberId}};}};
  await acceptPortalInvitation(context,{token:input.token,commandId},store);await acceptPortalInvitation(context,{token:input.token,commandId},store);
  assert.equal(hashes[0],hashes[1]);
});
