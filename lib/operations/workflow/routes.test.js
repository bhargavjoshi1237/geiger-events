import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { OperationsError } from '../errors.js';
const root=new URL('../../../',import.meta.url);
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('@/')){let url=new URL(specifier.slice(2),root);if(!existsSync(fileURLToPath(url)))url=new URL(`${specifier.slice(2)}.js`,root);return next(url.href,context);}return next(specifier,context);}});
const staffRoute=await import('../../../app/api/events/[eventId]/operations/workflow/route.js');
const portalRoute=await import('../../../app/api/portal/operations/[eventId]/route.js');
const acceptanceRoute=await import('../../../app/api/portal/operations/invitations/accept/route.js');
const registrationRoute=await import('../../../app/api/portal/operations/invitations/register/route.js');
const staff=await import('./routes.js');
const portal=await import('../portal/routes.js');
const acceptance=portal;
const registration=portal;
const id='11111111-1111-4111-8111-111111111111';const params=Promise.resolve({eventId:id});
const body={action:'savePerson',expectedRevision:0,commandId:id,name:'Jane',email:''};
const request=(payload=body)=>new Request('https://example.test/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
const snapshot={revision:0,enabled:true,people:[{id,name:'Jane',email:'jane@example.test',roles:['presenter']}],resources:[],activities:[],assignments:[],cycles:[],evaluations:[],attendance:[],releases:[],acknowledgements:[],tasks:[],outbox:[],invitations:[],identityLinks:[{id,kind:'portal',principalId:id,personId:id}]};
const store={snapshot:async()=>snapshot,mutate:async()=>({revision:1,result:{id}})};
test('actual Next staff route rejects missing credentials and all route methods load with alias hooks only',async()=>{
  assert.equal((await staffRoute.GET(new Request('https://example.test'),{params})).status,401);
  assert.equal(typeof portalRoute.GET,'function');assert.equal(typeof acceptanceRoute.POST,'function');assert.equal(typeof registrationRoute.POST,'function');
});
test('staff route validates event/body and dispatches create versus configure permission',async()=>{
  assert.equal(typeof staff.createWorkflowHandlers,'function');let permission;
  const handlers=staff.createWorkflowHandlers({resolvePrincipal:async()=>({kind:'staff',id}),authorize:async(principal,eventId,p)=>{permission=p;return {principal,eventId,projectId:id,permission:p};},store});
  const response=await handlers.POST(request(),{params});assert.equal(response.status,200);assert.equal(permission,'events.operations.record_create');assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal((await response.json()).revision,1);
  assert.equal((await handlers.POST(request({...body,action:'publishProgramme',name:undefined,email:undefined}),{params})).status,200);assert.equal(permission,'events.operations.configure');
  assert.equal((await handlers.GET(request(),{params:Promise.resolve({eventId:'bad'})})).status,400);
  assert.equal((await handlers.POST(request({...body,principalKind:'portal'}),{params})).status,422);
});
test('staff route propagates authorization denial and malformed JSON without invoking commands',async()=>{
  const handlers=staff.createWorkflowHandlers({resolvePrincipal:async()=>{throw new OperationsError('unauthenticated',401,'Sign in.');},store});
  assert.equal((await handlers.GET(request(),{params})).status,401);
  const allowed=staff.createWorkflowHandlers({resolvePrincipal:async()=>({kind:'staff',id}),authorize:async()=>({principal:{kind:'staff',id},permission:'events.operations.record_create'}),store});
  const response=await allowed.POST(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'}),{params});assert.equal(response.status,400);
});
test('portal route verifies portal session independently and restricts mutation action',async()=>{
  assert.equal(typeof portal.createPortalWorkflowHandlers,'function');
  const handlers=portal.createPortalWorkflowHandlers({resolvePrincipal:async()=>({kind:'portal',id,email:'jane@example.test'}),loadContext:async(eventId,principal)=>({eventId,projectId:id,principal}),store});
  const response=await handlers.GET(request(),{params});assert.equal(response.status,200);const dto=await response.json();assert.equal(dto.personId,id);assert.equal(dto.identityLinks,undefined);
  assert.equal((await handlers.POST(request(),{params})).status,403);
});
test('invitation acceptance requires signed-in principal and strips client email identity claims',async()=>{
  assert.equal(typeof acceptance.createInvitationHandler,'function');const handler=acceptance.createInvitationHandler({resolvePrincipal:async()=>({kind:'portal',id,email:'jane@example.test'}),loadContext:async(eventId,principal)=>({eventId,projectId:id,principal}),store});
  assert.equal((await handler(request({eventId:id,token:'a'.repeat(43),commandId:id}))).status,200);
  assert.equal((await handler(request({eventId:id,token:'a'.repeat(43),commandId:id,principalEmail:'attacker@example.test'}))).status,422);
});
test('registration issues HTTP-only cookie and never sends raw session token in JSON',async()=>{
  assert.equal(typeof registration.createRegistrationHandler,'function');const handler=registration.createRegistrationHandler({register:async()=>({memberId:id,sessionToken:'a'.repeat(43),expiresAt:'2099-01-01T00:00:00Z'})});
  const response=await handler(request({eventId:id,token:'a'.repeat(43),email:'jane@example.test',name:'Jane',password:'password-123456'}));assert.equal(response.status,200);assert.match(response.headers.get('Set-Cookie'),/HttpOnly/);assert.equal((await response.json()).sessionToken,undefined);
});
test('legacy source listing requires configure, protects source fields and rejects unknown source queries',async()=>{
  let permission;
  const handlers=staff.createWorkflowHandlers({resolvePrincipal:async()=>({kind:'staff',id}),authorize:async(principal,eventId,p)=>{permission=p;return {principal,eventId,projectId:id,permission:p};},store:{...store,acceptedItems:async()=>({items:[{id,title:'Talk',authorName:'Jane',email:'jane@example.test',format:'Talk',reviewerNotes:'SECRET'}],truncated:false})}});
  const response=await handlers.GET(new Request('https://example.test/api?source=accepted'),{params});assert.equal(response.status,200);assert.equal(permission,'events.operations.configure');const dto=await response.json();assert.equal(dto.items[0].title,'Talk');assert.equal(JSON.stringify(dto).includes('SECRET'),false);
  assert.equal((await handlers.GET(new Request('https://example.test/api?source=unknown'),{params})).status,422);
});
test('staff import routes distinguish create-only data from existing record IDs',async()=>{
  let permission;const handlers=staff.createWorkflowHandlers({resolvePrincipal:async()=>({kind:'staff',id}),authorize:async(principal,eventId,p)=>{permission=p;return {principal,eventId,projectId:id,permission:p};},store:{...store,snapshot:async()=>({...snapshot,identityLinks:[]})}});
  const response=await handlers.POST(request({action:'importPeople',expectedRevision:0,commandId:id,items:[{id,name:'Changed',email:''}]}),{params});assert.equal(response.status,200);assert.equal(permission,'events.operations.record_update');
  const imported=await handlers.POST(request({action:'importAcceptedItems',expectedRevision:0,commandId:id,itemIds:[id]}),{params});assert.equal(imported.status,200);assert.equal(permission,'events.operations.configure');
});
test('staff history route uses archive permission and does not expose private table scope columns',async()=>{
  let permission;const handlers=staff.createWorkflowHandlers({resolvePrincipal:async()=>({kind:'staff',id}),authorize:async(principal,eventId,p)=>{permission=p;return {principal,eventId,projectId:id,permission:p};},store:{...store,history:async()=>({attendanceRevisions:[],evaluationRevisions:[{id,evaluationId:id,revision:1,notes:'Private',projectId:'SECRET'}],truncated:false})}});
  const response=await handlers.GET(new Request('https://example.test/api?source=history'),{params});assert.equal(response.status,200);assert.equal(permission,'events.operations.record_archive');assert.equal(JSON.stringify(await response.json()).includes('SECRET'),false);
});
