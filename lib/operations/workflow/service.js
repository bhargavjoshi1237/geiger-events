import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { OperationsError } from '../errors.js';
import { workflowStore } from '../server/workflow_store.js';
import { operationsStore } from '../server/store.js';
import { getModuleDefinition } from '../modules/registry.js';
import { saveWorkspaceDraft, publishWorkspace } from '../workspaces/service.js';
import { projectPortalWorkflow, portalPerson,aggregateResults } from '../portal/projection.js';
import { validateWorkflowInput, workflowPermission, forbidden, fail } from './validation.js';

const collections=['people','resources','activities','assignments','cycles','evaluations','attendance','releases','acknowledgements','tasks','outbox','invitations','identityLinks'];
const fields={
  people:['id','name','email','contactId','roles','revision'],resources:['id','name','kind','capacity','location','availableFrom','availableUntil','revision'],
  activities:['id','title','kind','resourceId','parentId','startsAt','endsAt','timezone','capacity','revision'],assignments:['id','activityId','personId','role','cycleId','status','dueAt'],
  cycles:['id','title','rubric','state','dueAt','revision'],evaluations:['id','assignmentId','cycleId','personId','activityId','status','scores','notes','submittedAt','revision','approvedFeedback','feedbackApprovedAt','feedbackApprovedBy'],
  attendance:['id','activityId','personId','purpose','status','notes','recordedAt','revision'],releases:['id','version','createdAt','items'],acknowledgements:['id','releaseId','activityId','personId','releasedRevision','createdAt','revision','acknowledgedAt'],
  tasks:['id','title','personId','activityId','dueAt','status','revision'],outbox:['id','kind','personId','releaseId','status','attempts','nextAttemptAt','lastError','providerId','payload'],
  invitations:['id','personId','email','expiresAt','acceptedAt','revokedAt'],identityLinks:['id','personId','kind','principalId','invitationId'],
};
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
function dtoValue(value,key=''){
  if(typeof value==='string'&&/(?:At|From|Until)$/.test(key)&&Number.isFinite(Date.parse(value)))return new Date(value).toISOString();
  if(Array.isArray(value))return value.map(x=>dtoValue(x));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['tokenHash','token_hash','passwordHash','password_hash','requestHash','request_hash'].includes(k)).map(([k,v])=>[k,dtoValue(v,k)]));
  return value;
}
function privateSnapshot(input){
  if(!input||!Number.isSafeInteger(input.revision))throw new OperationsError('service_unavailable',503,'Invalid workflow response.');
  const result={revision:input.revision,enabled:input.enabled===true,truncated:input.truncated===true};
  for(const key of collections){const rows=input[key]??[];if(!Array.isArray(rows))throw new OperationsError('service_unavailable',503,'Invalid workflow response.');if(rows.length>=500)result.truncated=true;result[key]=rows.slice(0,500).map(row=>Object.fromEntries(fields[key].filter(k=>Object.hasOwn(row,k)).map(k=>[k,dtoValue(row[k],k)])));}
  return result;
}
export async function readWorkflow(context,store=workflowStore){
  if(!['staff','portal'].includes(context?.principal?.kind)||!context.principal.id)forbidden();
  const snapshot=privateSnapshot(await store.snapshot(context));
  if(context.principal.kind==='portal')return projectPortalWorkflow(snapshot,context.principal);
  const results=aggregateResults(snapshot,new Set(snapshot.activities.map(x=>x.id)),{releasedOnly:false});
  return {...snapshot,results,truncated:snapshot.truncated||results.length>=500};
}
export async function readAcceptedItems(context,store=workflowStore){
  if(context?.principal?.kind!=='staff'||!context.principal.id||context.permission!=='events.operations.configure')forbidden();
  const snapshot=privateSnapshot(await store.snapshot(context));
  if(!snapshot.enabled)throw new OperationsError('workflow_disabled',403,'Operations are not enabled.');
  const source=await store.acceptedItems(context);
  if(!source||!Array.isArray(source.items))throw new OperationsError('service_unavailable',503,'Accepted submissions are unavailable.');
  return {items:source.items.slice(0,500).map(row=>Object.fromEntries(['id','title','authorName','email','format'].map(key=>[key,row[key]??'']))),truncated:source.truncated===true||source.items.length>500};
}
export async function readWorkflowHistory(context,store=workflowStore){
  if(context?.principal?.kind!=='staff'||!context.principal.id||context.permission!=='events.operations.record_archive')forbidden();
  const snapshot=privateSnapshot(await store.snapshot(context));
  if(!snapshot.enabled)throw new OperationsError('workflow_disabled',403,'Operations are not enabled.');
  const history=await store.history(context);
  const allowed={attendanceRevisions:['id','attendanceId','activityId','personId','purpose','revision','status','notes','recordedAt','actorId'],evaluationRevisions:['id','evaluationId','assignmentId','cycleId','personId','activityId','revision','status','scores','notes','submittedAt','actorId']};
  const result={truncated:history?.truncated===true};
  for(const [key,keys] of Object.entries(allowed)){
    if(!Array.isArray(history?.[key]))throw new OperationsError('service_unavailable',503,'Workflow history is unavailable.');
    if(history[key].length>500)result.truncated=true;
    result[key]=history[key].slice(0,500).map(row=>Object.fromEntries(keys.filter(k=>Object.hasOwn(row,k)).map(k=>[k,dtoValue(row[k],k)])));
  }
  return result;
}
function find(snapshot,key,id){const row=snapshot[key].find(x=>x.id===id);if(!row)fail('The referenced record is outside this event or no longer available.');return row;}
function references(snapshot,command){
  for(const [field,key] of Object.entries({personId:'people',activityId:'activities',resourceId:'resources',parentId:'activities',cycleId:'cycles',assignmentId:'assignments',releaseId:'releases',invitationId:'invitations',evaluationId:'evaluations',taskId:'tasks',noticeId:'outbox'}))if(command[field])find(snapshot,key,command[field]);
  const targets={savePerson:'people',saveResource:'resources',saveActivity:'activities',saveAssignment:'assignments',saveCycle:'cycles',saveTask:'tasks'};
  if(command.id&&targets[command.action]&&collections.some(key=>key!==targets[command.action]&&snapshot[key].some(x=>x.id===command.id)))fail('The record ID belongs to a different record type.');
  if(command.action==='importActivities'){
    const imported={...snapshot,activities:[...snapshot.activities,...command.items.filter(x=>x.id&&!snapshot.activities.some(row=>row.id===x.id))]};
    for(const item of command.items)references(imported,{action:'saveActivity',...item});
  }
  if(command.action==='importPeople')for(const item of command.items)references(snapshot,{action:'savePerson',...item});
  if(command.action==='saveEvaluation'){
    const assignment=find(snapshot,'assignments',command.assignmentId);const cycle=find(snapshot,'cycles',assignment.cycleId);
    if(assignment.role!=='evaluator'||assignment.status!=='active'||cycle.state!=='open')forbidden();
    const rubric=new Map(cycle.rubric.map(x=>[x.id,x]));
    for(const [id,score]of Object.entries(command.scores)){const c=rubric.get(id);if(!c||score<c.min||score>c.max)fail('Score is outside the rubric range.');}
    if(command.submit&&cycle.rubric.some(x=>!Object.hasOwn(command.scores,x.id)))fail('Submission requires every rubric score.');
    if(snapshot.evaluations.some(x=>x.assignmentId===assignment.id&&x.status==='submitted'))throw new OperationsError('evaluation_submitted',409,'Submitted results must be reopened by an event manager.');
  }
  if(command.action==='saveAssignment'&&command.role==='evaluator'){
    if(!command.cycleId)fail('Evaluator assignment requires a cycle.');
    const existing=command.id&&snapshot.assignments.find(x=>x.id===command.id);
    const revoking=command.status==='revoked'&&existing&&existing.role==='evaluator'&&existing.activityId===command.activityId&&existing.personId===command.personId&&existing.cycleId===command.cycleId;
    if(!revoking&&!['draft','open'].includes(find(snapshot,'cycles',command.cycleId).state))fail('Evaluator assignment requires an open or draft cycle.');
  }
  if(command.action==='approveFeedback'&&find(snapshot,'evaluations',command.evaluationId).status!=='submitted')fail('Feedback approval requires a submitted evaluation.');
  if(command.action==='invite'&&!find(snapshot,'people',command.personId).email)fail('Invitation requires a person email.');
}
function authorizePortal(snapshot,context,command){
  if(command.action==='acceptInvitation'){if(!context.principal.email)forbidden();return;}
  const own=portalPerson(snapshot,context.principal);const active=snapshot.assignments.filter(x=>x.personId===own.id&&x.status==='active');
  switch(command.action){
    case 'saveEvaluation':if(!active.some(x=>x.id===command.assignmentId&&x.role==='evaluator'))forbidden();break;
    case 'acknowledgePlacement':if(!active.some(x=>x.activityId===command.activityId&&['presenter','participant'].includes(x.role)))forbidden();break;
    case 'markAttendance':if(!active.some(x=>x.activityId===command.activityId&&x.role==='staff'))forbidden();break;
    case 'completeTask':if(!snapshot.tasks.some(x=>x.id===command.taskId&&x.personId===own.id))forbidden();break;
    default:forbidden();
  }
}
async function enable(context,store){
  const workspaceStore=store.workspaceStore??operationsStore;const current=await workspaceStore.readWorkspace(context);
  if(current.status==='archived')throw new OperationsError('workspace_disabled',409,'Restore this workspace before enabling operations.');
  if(JSON.stringify(current.draft)!==JSON.stringify(current.modules))throw new OperationsError('unpublished_draft',409,'Publish or discard the saved draft before enabling operations.');
  const modules=[...current.modules];for(const key of ['ops-people','ops-resources','ops-activities']){
    const existing=modules.find(x=>x.key===key);if(existing?.enabled===false)throw new OperationsError('module_disabled',409,'Restore the disabled workflow module first.');
    if(!existing){const definition=getModuleDefinition(key);if(!definition)throw new OperationsError('service_unavailable',503,'Workflow module definitions are unavailable.');modules.push(definition);}
  }
  if(modules.length!==current.modules.length||!current.publishedVersion){const saved=await saveWorkspaceDraft(context,{expectedRevision:current.revision,modules},workspaceStore);await publishWorkspace(context,{expectedRevision:saved.revision,commandId:randomUUID()},workspaceStore);}
}
function mapped(error){
  const mappings={P7002:['schedule_conflict',409,'This allocation conflicts with the current schedule.'],42501:['forbidden',403,'You cannot perform this action.'],P7003:['invitation_invalid',403,'This invitation is expired, revoked, or already used.']};
  if(mappings[error?.code]){const [code,status,message]=mappings[error.code];return new OperationsError(code,status,message);}return error;
}
export async function executeWorkflowCommand(context,input,store=workflowStore){
  const command=validateWorkflowInput(input);const principal=context?.principal;
  if(!['staff','portal'].includes(principal?.kind)||!principal.id)forbidden();
  if(principal.kind==='staff'){
    if(command.action==='acceptInvitation')forbidden();const permission=workflowPermission(command);
    if(context.permission!==permission&&context.permission!=='events.operations.configure')forbidden();
  }else if(!['acceptInvitation','acknowledgePlacement','saveEvaluation','markAttendance','completeTask'].includes(command.action))forbidden();
  const snapshot=privateSnapshot(await store.snapshot(context));
  if(!snapshot.enabled&&!['enableWorkflow','acceptInvitation'].includes(command.action))throw new OperationsError('workflow_disabled',403,'Operations are not enabled.');
  // A stale command must reach the transaction so exact replay precedes revision checking.
  if(command.expectedRevision===snapshot.revision){
    if(snapshot.truncated)throw new OperationsError('snapshot_incomplete',409,'Reload a complete workflow before making changes.');
    if(principal.kind==='portal')authorizePortal(snapshot,context,command);references(snapshot,command);
  }
  const hashInput={...command,principalKind:principal.kind,...(command.action==='acceptInvitation'?{principalEmail:principal.email}: {})};
  // Acceptance can begin before an identity link exists, so its endpoint selects a
  // revision. Keep that server-selected value out of the caller's replay identity.
  if(command.action==='acceptInvitation'&&context.acceptanceRevisionDerived)delete hashInput.expectedRevision;
  const requestHash=createHash('sha256').update(JSON.stringify(canonical(hashInput))).digest('hex');
  const payload={...command,requestHash,principalKind:principal.kind};let token;
  if(command.action==='acceptInvitation'){if(principal.kind!=='portal'||!principal.email)forbidden();payload.principalEmail=principal.email;}
  if(command.action==='invite'){token=randomBytes(32).toString('base64url');payload.tokenHash=createHash('sha256').update(token).digest('hex');}
  try{
    if(command.action==='enableWorkflow'&&command.expectedRevision===snapshot.revision)await enable(context,store);
    const response=await store.mutate(context,payload);
    return {revision:response.revision,result:{...dtoValue(response.result),...(token&&!response.replayed?{token}: {})}};
  }catch(error){throw mapped(error);}
}
