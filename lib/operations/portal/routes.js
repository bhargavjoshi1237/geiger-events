import { OperationsError } from '../errors.js';
import { handleOperationsRequest,readOperationsJson } from '../server/commands.js';
import { workflowStore } from '../server/workflow_store.js';
import { executeWorkflowCommand,readWorkflow } from '../workflow/service.js';
import { UUID,exact } from '../workflow/validation.js';
import { resolvePortalPrincipal,loadPortalContext,acceptPortalInvitation,registerInvitationAccount } from './identity.js';

function eventId(value){if(!UUID.test(value??''))throw new OperationsError('invalid_event',400,'Invalid event ID.');return value;}
export function createPortalWorkflowHandlers({resolvePrincipal=resolvePortalPrincipal,loadContext=loadPortalContext,store=workflowStore}={}){
  async function context(params){const values=await params;const id=eventId(values.eventId);return loadContext(id,await resolvePrincipal());}
  return {
    GET(_request,{params}){return handleOperationsRequest(async()=>readWorkflow(await context(params),store));},
    POST(request,{params}){return handleOperationsRequest(async()=>{const scope=await context(params);return executeWorkflowCommand(scope,await readOperationsJson(request),store);});},
  };
}
export function createInvitationHandler({resolvePrincipal=resolvePortalPrincipal,loadContext=loadPortalContext,store=workflowStore}={}){
  return request=>handleOperationsRequest(async()=>{
    const principal=await resolvePrincipal();const input=await readOperationsJson(request);exact(input,['eventId','token','commandId','expectedRevision']);
    const context=await loadContext(eventId(input.eventId),principal);const {eventId:_eventId,...command}=input;return acceptPortalInvitation(context,command,store);
  });
}
export function createRegistrationHandler({register=registerInvitationAccount}={}){
  return async request=>{
    let sessionToken;const response=await handleOperationsRequest(async()=>{const account=await register(await readOperationsJson(request));sessionToken=account.sessionToken;return {ok:true,memberId:account.memberId,expiresAt:account.expiresAt};});
    if(sessionToken){const secure=process.env.NODE_ENV==='production'?'; Secure':'';response.headers.set('Set-Cookie',`geP_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`);}
    return response;
  };
}
