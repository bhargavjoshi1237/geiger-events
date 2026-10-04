import { adminClient } from '../../supabase/admin.js';
import { OperationsError } from '../errors.js';

function db(){const value=adminClient();if(!value)throw new OperationsError('service_unavailable',503,'Operations are unavailable.');return value;}
function checked(result){if(result.error)throw result.error;return result.data;}
export const workflowStore={
  async snapshot(context){return checked(await db().rpc('ops_workflow_snapshot',{p_project_id:context.projectId,p_event_id:context.eventId}));},
  async acceptedItems(context){return checked(await db().rpc('ops_workflow_accepted_items',{p_project_id:context.projectId,p_event_id:context.eventId}));},
  async history(context){return checked(await db().rpc('ops_workflow_history',{p_project_id:context.projectId,p_event_id:context.eventId}));},
  async mutate(context,command){return checked(await db().rpc('ops_workflow_command',{p_project_id:context.projectId,p_event_id:context.eventId,p_actor_id:context.principal.id,p_command:command}));},
  async claimNotices(limit,leaseId){return checked(await db().rpc('ops_workflow_claim_notices',{p_limit:limit,p_lease_id:leaseId}));},
  async finishNotice(noticeId,leaseId,status,providerId,error){return checked(await db().rpc('ops_workflow_finish_notice',{p_notice_id:noticeId,p_lease_id:leaseId,p_status:status,p_provider_id:providerId,p_error:error}));},
};
