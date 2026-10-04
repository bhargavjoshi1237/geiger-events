import { OperationsError } from '../errors.js';
import { authorizeEventAction } from '../server/access.js';
import { handleOperationsRequest,readOperationsJson } from '../server/commands.js';
import { resolveStaffPrincipal } from '../server/staff_identity.js';
import { workflowStore } from '../server/workflow_store.js';
import { executeWorkflowCommand,readWorkflow,readAcceptedItems,readWorkflowHistory } from './service.js';
import { UUID,workflowPermission } from './validation.js';

export function createWorkflowHandlers({resolvePrincipal=resolveStaffPrincipal,authorize=authorizeEventAction,store=workflowStore}={}){
  async function event(params){const {eventId}=await params;if(!UUID.test(eventId??''))throw new OperationsError('invalid_event',400,'Invalid event ID.');return eventId;}
  return {
    GET(request,{params}){return handleOperationsRequest(async()=>{
      const eventId=await event(params);const principal=await resolvePrincipal(request);const source=new URL(request.url).searchParams.get('source');
      if(source!==null&&!['accepted','history'].includes(source))throw new OperationsError('invalid_input',422,'Unknown workflow source.');
      const permission=source==='history'?'events.operations.record_archive':source==='accepted'?'events.operations.configure':'events.operations.view';
      const context=await authorize(principal,eventId,permission);
      return source==='history'?readWorkflowHistory(context,store):source==='accepted'?readAcceptedItems(context,store):readWorkflow(context,store);
    });},
    POST(request,{params}){return handleOperationsRequest(async()=>{const eventId=await event(params);const principal=await resolvePrincipal(request);const input=await readOperationsJson(request);const context=await authorize(principal,eventId,workflowPermission(input));return executeWorkflowCommand(context,input,store);});},
  };
}
