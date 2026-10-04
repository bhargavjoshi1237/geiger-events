import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { adminClient } from '../../supabase/admin.js';
import { OperationsError } from '../errors.js';
import { workflowStore } from '../server/workflow_store.js';
import { executeWorkflowCommand } from '../workflow/service.js';
import { exact, uuid, text, forbidden } from '../workflow/validation.js';

const sha256=value=>createHash('sha256').update(value).digest('hex');
function db(){const client=adminClient();if(!client)throw new OperationsError('service_unavailable',503,'Operations are unavailable.');return client;}
function checked(result){if(result.error)throw result.error;return result.data;}
export async function resolvePortalPrincipal({getMember=async()=>{const {getSessionMember}=await import('../../portal/session.js');return getSessionMember();}}={}){
  const member=await getMember();if(!member?.id||!member.email)throw new OperationsError('unauthenticated',401,'Sign in to continue.');
  return {kind:'portal',id:member.id,email:member.email.trim().toLowerCase()};
}
export async function loadPortalContext(eventId,principal,{loadEvent=async id=>checked(await db().from('events').select('id,project_id').eq('id',id).maybeSingle())}={}){
  uuid(eventId);if(principal?.kind!=='portal'||!principal.id)forbidden();const event=await loadEvent(eventId);
  if(!event?.project_id)throw new OperationsError('not_found',404,'Event not found.');
  return {eventId,projectId:event.project_id,principal};
}
function token(value){if(typeof value!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value))throw new OperationsError('invitation_invalid',403,'This invitation is invalid.');}
export async function acceptPortalInvitation(context,input,store=workflowStore){
  exact(input,['token','commandId','expectedRevision']);token(input.token);uuid(input.commandId);
  if(context?.principal?.kind!=='portal'||!context.principal.email)forbidden();
  const expectedRevision=input.expectedRevision??(await store.snapshot(context)).revision;
  return executeWorkflowCommand({...context,acceptanceRevisionDerived:input.expectedRevision===undefined},{action:'acceptInvitation',tokenHash:sha256(input.token),commandId:input.commandId,expectedRevision},store);
}
const accountStore={
  async loadInvitation(eventId,tokenHash){const row=checked(await db().from('ops_invitations').select('email,expires_at,accepted_at,revoked_at').eq('event_id',eventId).eq('token_hash',tokenHash).maybeSingle());return row?{email:row.email,expiresAt:row.expires_at,acceptedAt:row.accepted_at,revokedAt:row.revoked_at}:null;},
  async findMember(email){return checked(await db().from('portal_members').select('id').eq('email',email).maybeSingle());},
  async createMember({email,name,passwordHash}){return checked(await db().from('portal_members').insert({email,name,password_hash:passwordHash}).select('id').single());},
  async createSession({memberId,tokenHash,expiresAt}){checked(await db().from('portal_sessions').insert({member_id:memberId,token_hash:tokenHash,expires_at:expiresAt}));},
};
export async function registerInvitationAccount(input,store=accountStore){
  exact(input,['eventId','token','email','name','password']);uuid(input.eventId);token(input.token);text(input.email,254);text(input.name,120);text(input.password,128);
  if(input.password.length<12)throw new OperationsError('invalid_password',422,'Use a password of at least 12 characters.');
  const email=input.email.trim().toLowerCase();
  const invitation=await store.loadInvitation(input.eventId,sha256(input.token));
  const expires=Date.parse(invitation?.expiresAt);
  if(!invitation||invitation.email?.trim().toLowerCase()!==email||!Number.isFinite(expires)||expires<=Date.now()||invitation.revokedAt||invitation.acceptedAt)throw new OperationsError('invitation_invalid',403,'This invitation is expired, revoked, or already used.');
  if(await store.findMember(email))throw new OperationsError('existing_account',409,'This account already exists. Sign in to accept the invitation.');
  const salt=randomBytes(16);const passwordHash=`scrypt$${salt.toString('hex')}$${scryptSync(input.password,salt,64).toString('hex')}`;
  let member;try{member=await store.createMember({email,name:input.name.trim(),passwordHash});}catch(error){if(error.code==='23505')throw new OperationsError('existing_account',409,'This account already exists. Sign in to accept the invitation.');throw error;}
  const sessionToken=randomBytes(32).toString('base64url');const expiresAt=new Date(Date.now()+30*864e5).toISOString();
  await store.createSession({memberId:member.id,tokenHash:sha256(sessionToken),expiresAt});
  return {memberId:member.id,sessionToken,expiresAt};
}
