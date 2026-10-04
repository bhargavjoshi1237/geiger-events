import { OperationsError } from '../errors.js';
import { forbidden } from '../workflow/validation.js';

export function portalPerson(snapshot,principal){
  const link=snapshot.identityLinks.find(x=>x.kind==='portal'&&x.principalId===principal.id);
  const person=link&&snapshot.people.find(x=>x.id===link.personId);
  if(!person)forbidden();
  if(link.invitationId){const invitation=snapshot.invitations.find(x=>x.id===link.invitationId);if(!invitation?.acceptedAt||invitation.revokedAt)forbidden();}
  return person;
}
export function aggregateResults(snapshot,activityIds,{releasedOnly=true}={}){
  const output=[];
  for(const cycle of snapshot.cycles.filter(x=>!releasedOnly||x.state==='released'))for(const activityId of activityIds){
    const evaluations=snapshot.evaluations.filter(x=>x.cycleId===cycle.id&&x.activityId===activityId&&x.status==='submitted');
    if(!evaluations.length&&!snapshot.assignments.some(x=>x.cycleId===cycle.id&&x.activityId===activityId))continue;
    const normalized=evaluations.map(x=>{
      let weighted=0,total=0;for(const criterion of cycle.rubric){const score=x.scores[criterion.id];if(typeof score!=='number'||!Number.isFinite(score)||criterion.max<=criterion.min||criterion.weight<=0)return null;weighted+=(score-criterion.min)/(criterion.max-criterion.min)*criterion.weight;total+=criterion.weight;}
      return total?weighted/total*100:null;
    }).filter(x=>x!==null);
    const feedback=evaluations.filter(x=>x.feedbackApprovedAt&&typeof x.approvedFeedback==='string'&&x.approvedFeedback.trim()).map(x=>x.approvedFeedback);
    output.push({cycleId:cycle.id,activityId,title:cycle.title,score:normalized.length?normalized.reduce((a,b)=>a+b,0)/normalized.length:null,evaluatorCount:normalized.length,feedback});
    if(output.length>=500)return output;
  }
  return output;
}
export function projectPortalWorkflow(snapshot,principal){
  if(!snapshot.enabled)throw new OperationsError('workflow_disabled',403,'Operations are not enabled.');
  if(snapshot.truncated)throw new OperationsError('snapshot_incomplete',409,'This workflow is too large to display safely. Ask the event team for a scoped export.');
  const own=portalPerson(snapshot,principal);
  const assignments=snapshot.assignments.filter(x=>x.personId===own.id&&x.status==='active');
  const activityIds=new Set(assignments.map(x=>x.activityId));
  const presenterIds=new Set(assignments.filter(x=>x.role==='presenter').map(x=>x.activityId));
  const staffIds=new Set(assignments.filter(x=>x.role==='staff').map(x=>x.activityId));
  const byId=new Map(snapshot.activities.map(x=>[x.id,x]));
  function effectiveResource(activity){const seen=new Set();let current=activity;while(current&&!seen.has(current.id)){seen.add(current.id);if(current.resourceId)return current.resourceId;current=byId.get(current.parentId);}return null;}
  const activityRows=snapshot.activities.filter(x=>activityIds.has(x.id)).map(x=>({...x,resourceId:effectiveResource(x)}));
  const resources=new Set(activityRows.map(x=>x.resourceId).filter(Boolean));
  const evaluatorAssignments=new Set(assignments.filter(x=>x.role==='evaluator').map(x=>x.id));
  const cycleIds=new Set(assignments.map(x=>x.cycleId).filter(Boolean));
  const attendancePeople=new Set(snapshot.assignments.filter(x=>staffIds.has(x.activityId)&&x.status==='active').map(x=>x.personId));
  const ownAttendance=snapshot.attendance.filter(x=>x.personId===own.id||staffIds.has(x.activityId)).map(({notes: _notes,...row})=>row);
  const latestRelease=snapshot.releases.reduce((latest,item)=>!latest||item.version>latest.version?item:latest,null);
  const published=snapshot.releases.map(release=>({...release,items:release.items.filter(item=>activityIds.has(item.activityId??item.id)).map(item=>{
    const {assignments: releaseAssignments,...placement}=item;
    return {...placement,...(releaseAssignments?{assignments:releaseAssignments.filter(x=>x.personId===own.id).map(({id,role,personId,activityId})=>({id,role,personId,activityId}))}:{})};
  })})).filter(x=>x.items.length||x.id===latestRelease?.id);
  return {revision:snapshot.revision,enabled:true,truncated:false,person:{id:own.id,name:own.name,email:own.email,roles:own.roles,revision:own.revision},personId:own.id,
    people:snapshot.people.filter(x=>x.id===own.id||attendancePeople.has(x.id)).map(({id,name})=>({id,name})),
    resources:snapshot.resources.filter(x=>resources.has(x.id)),activities:activityRows,assignments,
    cycles:snapshot.cycles.filter(x=>cycleIds.has(x.id)),evaluations:snapshot.evaluations.filter(x=>evaluatorAssignments.has(x.assignmentId)),
    attendance:ownAttendance,releases:published,acknowledgements:snapshot.acknowledgements.filter(x=>x.personId===own.id),tasks:snapshot.tasks.filter(x=>x.personId===own.id),
    outbox:snapshot.outbox.filter(x=>x.personId===own.id).map(({id,kind,releaseId,status,nextAttemptAt})=>({id,kind,releaseId,status,nextAttemptAt})),results:aggregateResults(snapshot,presenterIds)};
}
