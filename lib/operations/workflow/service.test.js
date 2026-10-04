import test from 'node:test';
import assert from 'node:assert/strict';

const loaded = await import('./service.js').catch(() => ({}));
const { executeWorkflowCommand, readWorkflow,readWorkflowHistory } = loaded;
const ids = ['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
const context = {projectId: ids[0], eventId: ids[1],principal:{kind:'staff',id:ids[2]},permission:'events.operations.configure'};
const cmd = (action,payload={}) => ({action,expectedRevision:0,commandId:ids[3],...payload});
const snapshot = () => ({revision:0,enabled:true, people:[],resources:[],activities:[],assignments:[],cycles:[],evaluations:[],attendance:[],releases:[],acknowledgements:[],tasks:[],outbox:[],invitations:[],identityLinks:[]});
function memory(data=snapshot()) {return {snapshot:async()=>data, mutate:async(_ctx,command)=>({revision:1,result:command})};}
test('imports carrying explicit record IDs require update permission',async()=>{
  const create={...context,permission:'events.operations.record_create'};
  for(const [action,item] of [['importPeople',{id:ids[0],name:'Existing',email:''}],['importActivities',{id:ids[0],title:'Existing',kind:'talk',timezone:'UTC'}]]){
    await assert.rejects(executeWorkflowCommand(create,cmd(action,{items:[item]}),memory()),{status:403});
    assert.equal((await executeWorkflowCommand({...context,permission:'events.operations.record_update'},cmd(action,{items:[item]}),memory())).revision,1);
  }
});
test('manager can revoke an existing evaluator allocation after results release',async()=>{
  const data=snapshot();data.people=[{id:ids[0]}];data.activities=[{id:ids[1]}];data.cycles=[{id:ids[2],state:'released',rubric:[]}];data.assignments=[{id:ids[3],activityId:ids[1],personId:ids[0],role:'evaluator',cycleId:ids[2],status:'active'}];
  assert.equal((await executeWorkflowCommand(context,cmd('saveAssignment',{id:ids[3],activityId:ids[1],personId:ids[0],role:'evaluator',cycleId:ids[2],status:'revoked'}),memory(data))).revision,1);
  await assert.rejects(executeWorkflowCommand(context,cmd('saveAssignment',{id:ids[3],activityId:ids[1],personId:ids[0],role:'evaluator',cycleId:ids[2],status:'active'}),memory(data)),{status:422});
});
test('workflow implementation exposes commands and reads',()=>{assert.equal(typeof executeWorkflowCommand,'function');assert.equal(typeof readWorkflow,'function');});
test('ordinary commands validate UUID revision and reject injected principal/hash/unknown keys',async()=>{
  for(const payload of [{principalKind:'portal'},{requestHash:'bad'},{commandId:'bad'},{expectedRevision:-1},{name:'x',email:'',extra:true}]) {
    await assert.rejects(executeWorkflowCommand(context,cmd('savePerson',{name:'Jane',email:'',...payload}),memory()),{status:422});
  }
});
test('all flat commands execute atomically with server principal and stable request hash',async()=>{
  const commands=[];const store={...memory(),mutate:async(_ctx,command)=>{commands.push(command);return {revision:1,result:{count:1}};}};
  const result=await executeWorkflowCommand(context,cmd('importPeople',{items:[{name:'Jane',email:'jane@example.test',roles:['presenter']}]}),store);
  assert.equal(result.revision,1);assert.equal(commands[0].principalKind,'staff');assert.match(commands[0].requestHash,/^[a-f0-9]{64}$/);assert.equal(commands[0].items[0].name,'Jane');
  await executeWorkflowCommand(context,cmd('importPeople',{items:[{roles:['presenter'],email:'jane@example.test',name:'Jane'}]}),store);
  assert.equal(commands[0].requestHash,commands[1].requestHash);
});
test('bad date pairs timezones capacities and rubric numbers cannot reach persistence',async()=>{
  for(const [action,payload] of [
    ['saveResource',{name:'Room',kind:'room',capacity:0}],
    ['saveResource',{name:'Room',kind:'room',capacity:1,availableFrom:'2026-10-02T01:00:00Z'}],
    ['saveActivity',{title:'Talk',kind:'talk',timezone:'Mars/Base'}],
    ['saveActivity',{title:'Talk',kind:'talk',timezone:'UTC',startsAt:'2026-10-02T01:00:00',endsAt:'2026-10-02T02:00:00Z'}],
    ['saveCycle',{title:'Judge',rubric:[{id:'a',label:'Quality',min:0,max:Infinity,weight:1}]}],
    ['saveCycle',{title:'Judge',rubric:[{id:'a',label:'Quality',min:0,max:1,weight:0}]}],
    ['importPeople',{items:Array.from({length:101},()=>({name:'A',email:''}))}],
  ]) await assert.rejects(executeWorkflowCommand(context,cmd(action,payload),memory()),{status:422});
});
test('cross-event reference and partial invalid import reject entire command',async()=>{
  await assert.rejects(executeWorkflowCommand(context,cmd('saveAssignment',{activityId:ids[0],personId:ids[1],role:'presenter'}),memory()),{status:422});
  await assert.rejects(executeWorkflowCommand(context,cmd('importPeople',{items:[{name:'Jane',email:''},{name:'',email:''}]}),memory()),{status:422});
});
test('evaluations validate full submitted rubric while drafts can be partial',async()=>{
  const data=snapshot();data.people=[{id:ids[0]}];data.activities=[{id:ids[1]}];data.cycles=[{id:ids[2],state:'open',rubric:[{id:'quality',min:0,max:10,weight:1},{id:'clarity',min:0,max:4,weight:1}]}];data.assignments=[{id:ids[3],personId:ids[0],activityId:ids[1],cycleId:ids[2],role:'evaluator',status:'active'}];
  for(const scores of [{quality:11},{quality:4},{quality:4,clarity:2,spoof:1}]) await assert.rejects(executeWorkflowCommand(context,cmd('saveEvaluation',{assignmentId:ids[3],scores,submit:true}),memory(data)),{status:422});
  assert.equal((await executeWorkflowCommand(context,cmd('saveEvaluation',{assignmentId:ids[3],scores:{quality:0}}),memory(data))).revision,1);
});
test('staff configure is required for invitations and cycle management',async()=>{
  await assert.rejects(executeWorkflowCommand({...context,permission:'events.operations.record_create'},cmd('saveCycle',{title:'Judging',rubric:[{id:'quality',label:'Quality',min:0,max:10,weight:1}]}),memory()),{status:403});
});
test('invitation secret only returned once and hash persisted without raw token',async()=>{
  const data=snapshot();data.people=[{id:ids[0],email:'jane@example.test'}];
  let persisted;const store={...memory(data),mutate:async(_ctx,command)=>{persisted=command;return {revision:1,result:{id:ids[1]}};}};
  const result=await executeWorkflowCommand(context,cmd('invite',{personId:ids[0]}),store);
  assert.match(result.result.token,/^[A-Za-z0-9_-]{43}$/);assert.match(persisted.tokenHash,/^[a-f0-9]{64}$/);assert.equal(persisted.token,undefined);assert.equal(result.result.tokenHash,undefined);
  store.mutate=async()=>({revision:1,result:{id:ids[1]},replayed:true});
  assert.equal((await executeWorkflowCommand(context,cmd('invite',{personId:ids[0]}),store)).result.token,undefined);
});
test('exact stale replay is delegated atomically before current reference validation',async()=>{
  const data=snapshot();data.revision=3;
  const response=await executeWorkflowCommand(context,cmd('saveAssignment',{activityId:ids[0],personId:ids[1],role:'presenter'}),{snapshot:async()=>data,mutate:async()=>({revision:1,result:{id:ids[3]},replayed:true})});
  assert.equal(response.revision,1);
});
test('database schedule errors are mapped without exposing SQL',async()=>{
  await assert.rejects(executeWorkflowCommand(context,cmd('publishProgramme'),{...memory(),mutate:async()=>{throw {code:'P7002',message:'private SQL'};}}),{code:'schedule_conflict',status:409});
});
test('portal reads exclude unrelated work and private notes; aggregate preserves zero',async()=>{
  const data=snapshot();data.people=[{id:ids[0],name:'Presenter',email:'p@example.test'},{id:ids[2],name:'Other',email:'private@example.test'}];data.identityLinks=[{id:'link',kind:'portal',principalId:ids[3],personId:ids[0]}];data.activities=[{id:ids[1],title:'Own'},{id:ids[2],title:'Private'}];data.assignments=[{id:'a',personId:ids[0],activityId:ids[1],role:'presenter',status:'active'},{id:'b',personId:ids[2],activityId:ids[2],role:'evaluator',status:'active'}];data.cycles=[{id:ids[2],state:'released',rubric:[{id:'quality',min:0,max:10,weight:1}]}];data.evaluations=[{id:'e',cycleId:ids[2],activityId:ids[1],personId:ids[2],status:'submitted',scores:{quality:0},notes:'secret',submittedAt:'2026-10-02T01:00:00Z'}];
  const result=await readWorkflow({...context,principal:{kind:'portal',id:ids[3],email:'p@example.test'}},memory(data));
  assert.deepEqual(result.activities.map(x=>x.title),['Own']);assert.equal(JSON.stringify(result).includes('secret'),false);assert.equal(JSON.stringify(result).includes('private@example.test'),false);assert.equal(result.results[0].score,0);assert.equal(result.identityLinks,undefined);
});
test('portal revocation immediately prevents read and own mutations',async()=>{
  const data=snapshot();data.people=[{id:ids[0]}];data.identityLinks=[{id:'link',kind:'portal',principalId:ids[3],personId:ids[0]}];data.activities=[{id:ids[1]}];data.assignments=[{id:ids[2],personId:ids[0],activityId:ids[1],role:'presenter',status:'revoked'}];
  await assert.rejects(executeWorkflowCommand({...context,principal:{kind:'portal',id:ids[3]}},cmd('acknowledgePlacement',{releaseId:ids[2],activityId:ids[1]}),memory(data)),{status:403});
});
test('enablement preserves existing draft and merges core modules into a clean published workspace',async()=>{
  const data=snapshot();data.enabled=false;
  const draftStore={...memory(data),workspaceStore:{readWorkspace:async()=>({revision:2,status:'published',publishedVersion:1,modules:[],draft:[{key:'unpublished'}]})}};
  await assert.rejects(executeWorkflowCommand(context,cmd('enableWorkflow'),draftStore),{code:'unpublished_draft',status:409});
  let current={revision:2,status:'published',publishedVersion:1,modules:[],draft:[]};let published;
  const workspaceStore={readWorkspace:async()=>current,countModuleRecords:async()=>0,lookupReceipt:async()=>null,saveDraft:async(_ctx,{modules})=>{current={...current,draft:modules,revision:3};return {revision:3};},publish:async(_ctx,input)=>{published=input.modules;return {revision:4};}};
  assert.equal((await executeWorkflowCommand(context,cmd('enableWorkflow'),{...memory(data),workspaceStore})).revision,1);
  assert.deepEqual(published.map(x=>x.key),['ops-people','ops-resources','ops-activities']);
});
test('private snapshots normalize UTC dates strip token hashes and signal bounded collections',async()=>{
  const data=snapshot();data.invitations=[{id:ids[0],personId:ids[1],email:'jane@example.test',tokenHash:'SECRET',expiresAt:'2026-10-02T12:00:00+05:30'}];data.people=Array.from({length:501},(_,i)=>({id:String(i),name:'Person'}));
  const result=await readWorkflow(context,memory(data));assert.equal(result.people.length,500);assert.equal(result.truncated,true);assert.equal(result.invitations[0].tokenHash,undefined);assert.equal(result.invitations[0].expiresAt,'2026-10-02T06:30:00.000Z');
});
test('staff aggregate weights evaluators equally and distinguishes no submission from score zero',async()=>{
  const data=snapshot();data.activities=[{id:ids[0]},{id:ids[1]}];data.cycles=[{id:ids[2],title:'Round 1',state:'open',rubric:[{id:'a',min:0,max:10,weight:1},{id:'b',min:0,max:4,weight:3}]}];data.assignments=[{id:'a',cycleId:ids[2],activityId:ids[0]},{id:'b',cycleId:ids[2],activityId:ids[1]}];data.evaluations=[{id:'1',cycleId:ids[2],activityId:ids[0],status:'submitted',scores:{a:10,b:0}},{id:'2',cycleId:ids[2],activityId:ids[0],status:'submitted',scores:{a:0,b:4}}];
  const dto=await readWorkflow(context,memory(data));assert.equal(dto.results.find(x=>x.activityId===ids[0]).score,50);assert.equal(dto.results.find(x=>x.activityId===ids[1]).score,null);assert.equal(dto.results.find(x=>x.activityId===ids[0]).evaluatorCount,2);
});
test('revoking accepted invitation removes portal access even while assignments remain live',async()=>{
  const data=snapshot();data.people=[{id:ids[0],name:'Person'}];data.identityLinks=[{id:ids[1],kind:'portal',principalId:ids[3],personId:ids[0],invitationId:ids[2]}];data.invitations=[{id:ids[2],personId:ids[0],acceptedAt:'2026-10-01T00:00:00Z',revokedAt:'2026-10-02T00:00:00Z'}];data.tasks=[{id:ids[1],personId:ids[0],status:'open'}];
  const portal={...context,principal:{kind:'portal',id:ids[3],email:'p@example.test'}};
  await assert.rejects(readWorkflow(portal,memory(data)),{status:403});await assert.rejects(executeWorkflowCommand(portal,cmd('completeTask',{taskId:ids[1]}),memory(data)),{status:403});
});
test('acknowledgement snapshot preserves immutable released revision',async()=>{
  const data=snapshot();data.acknowledgements=[{id:ids[0],releaseId:ids[1],activityId:ids[2],personId:ids[3],releasedRevision:8,createdAt:'2026-10-02T00:00:00Z'}];
  const dto=await readWorkflow(context,memory(data));assert.equal(dto.acknowledgements[0].releasedRevision,8);
});
test('every staff workflow command has a validated flat atomic dispatch contract',async()=>{
  const data=snapshot();data.people=[{id:ids[0],name:'Person',email:'p@example.test'}];data.resources=[{id:ids[0],capacity:20}];data.activities=[{id:ids[1]}];data.cycles=[{id:ids[2],title:'Judging',state:'open',rubric:[{id:'quality',label:'Quality',min:0,max:10,weight:1}]}];data.assignments=[{id:ids[3],activityId:ids[1],personId:ids[0],role:'evaluator',cycleId:ids[2],status:'active'}];data.evaluations=[{id:ids[2],assignmentId:ids[3],status:'draft'}];data.releases=[{id:ids[2],items:[]}];data.invitations=[{id:ids[2]}];data.tasks=[{id:ids[2],personId:ids[0]}];data.outbox=[{id:ids[2],status:'failed'}];
  const cases=[
    ['savePerson',{name:'Person',email:'',roles:[]}],['saveResource',{name:'Room',kind:'room',capacity:20}],['saveActivity',{title:'Talk',kind:'talk',timezone:'Asia/Calcutta'}],['saveAssignment',{activityId:ids[1],personId:ids[0],role:'evaluator',cycleId:ids[2]}],
    ['publishProgramme',{}],['invite',{personId:ids[0],expiresInDays:7}],['revokeInvitation',{invitationId:ids[2]}],['linkStaff',{personId:ids[0],userId:ids[3]}],['saveCycle',{title:'Judging',rubric:[{id:'quality',label:'Quality',min:0,max:10,weight:1}]}],['releaseResults',{cycleId:ids[2]}],['reopenEvaluation',{evaluationId:ids[2],reason:'Corrected submission'}],['saveEvaluation',{assignmentId:ids[3],scores:{quality:0},submit:true}],['markAttendance',{activityId:ids[1],personId:ids[0],purpose:'delivery',status:'absent'}],['saveTask',{title:'Follow up',personId:ids[0],activityId:ids[1]}],['completeTask',{taskId:ids[2]}],['importPeople',{items:[{name:'Person',email:''}]}],['importActivities',{items:[{title:'Talk',kind:'talk',timezone:'UTC'}]}],['retryNotice',{noticeId:ids[2]}],['queueReminders',{}],
  ];
  for(const [action,payload]of cases){const result=await executeWorkflowCommand(context,cmd(action,payload),memory(data));assert.equal(result.revision,1,action);assert.equal(result.result.action,action,action);}
});
test('atomic imports accept new client UUIDs and in-batch activity parents',async()=>{
  const store=memory();const people=await executeWorkflowCommand(context,cmd('importPeople',{items:[{id:ids[0],name:'Person',email:''}]}),store);assert.equal(people.revision,1);
  const activities=await executeWorkflowCommand(context,cmd('importActivities',{items:[{id:ids[0],title:'Session',kind:'session',timezone:'UTC'},{id:ids[1],title:'Talk',kind:'talk',parentId:ids[0],timezone:'UTC'}]}),store);assert.equal(activities.revision,1);
});
test('portal child placement resolves inherited room without exposing parent or sibling records',async()=>{
  const data=snapshot();data.people=[{id:ids[0],name:'Presenter'}];data.identityLinks=[{id:'link',kind:'portal',principalId:ids[3],personId:ids[0]}];data.resources=[{id:ids[2],name:'Room A'}];data.activities=[{id:ids[0],title:'Private parent',resourceId:ids[2]},{id:ids[1],title:'Own talk',parentId:ids[0],resourceId:null}];data.assignments=[{id:ids[2],personId:ids[0],activityId:ids[1],role:'presenter',status:'active'}];
  const dto=await readWorkflow({...context,principal:{kind:'portal',id:ids[3]}},memory(data));assert.equal(dto.activities[0].resourceId,ids[2]);assert.equal(dto.resources[0].name,'Room A');assert.equal(dto.activities.length,1);assert.equal(JSON.stringify(dto).includes('Private parent'),false);
});
test('portal retains an empty latest release so historical placement cannot be acknowledged as current',async()=>{
  const data=snapshot();data.people=[{id:ids[0],name:'Person'}];data.identityLinks=[{id:'link',kind:'portal',principalId:ids[3],personId:ids[0]}];data.activities=[{id:ids[1]}];data.assignments=[{id:ids[2],personId:ids[0],activityId:ids[1],role:'presenter',status:'active'}];data.releases=[{id:ids[0],version:1,items:[{activityId:ids[1]}]},{id:ids[2],version:2,items:[{activityId:ids[3],title:'Private placement'}]}];
  const dto=await readWorkflow({...context,principal:{kind:'portal',id:ids[3]}},memory(data));const latest=dto.releases.reduce((a,b)=>a.version>b.version?a:b);assert.equal(latest.version,2);assert.deepEqual(latest.items,[]);assert.equal(JSON.stringify(dto).includes('Private placement'),false);
});
test('command responses sanitize secret fields and normalize persisted dates',async()=>{
  const response=await executeWorkflowCommand(context,cmd('savePerson',{name:'Person',email:''}),{...memory(),mutate:async()=>({revision:1,result:{id:ids[0],tokenHash:'secret',passwordHash:'secret',createdAt:'2026-10-02T12:00:00+05:30'}})});
  assert.equal(response.result.tokenHash,undefined);assert.equal(response.result.passwordHash,undefined);assert.equal(response.result.createdAt,'2026-10-02T06:30:00.000Z');
});
test('feedback approval is manager-only and cannot approve an unfinished evaluation',async()=>{
  const data=snapshot();data.evaluations=[{id:ids[0],status:'draft'}];
  await assert.rejects(executeWorkflowCommand(context,cmd('approveFeedback',{evaluationId:ids[0],feedback:'Shared feedback'}),memory(data)),{status:422});
  data.evaluations[0].status='submitted';
  await assert.rejects(executeWorkflowCommand({...context,permission:'events.operations.record_update'},cmd('approveFeedback',{evaluationId:ids[0],feedback:'Shared feedback'}),memory(data)),{status:403});
  const response=await executeWorkflowCommand(context,cmd('approveFeedback',{evaluationId:ids[0],feedback:''}),memory(data));assert.equal(response.result.feedback,'');
});
test('presenters see explicit approved feedback only after release and only while assigned',async()=>{
  const data=snapshot();data.people=[{id:ids[0]}];data.identityLinks=[{id:'link',kind:'portal',principalId:ids[3],personId:ids[0]}];data.activities=[{id:ids[1]}];data.assignments=[{id:'own',personId:ids[0],activityId:ids[1],role:'presenter',status:'active'}];data.cycles=[{id:ids[2],state:'open',rubric:[{id:'quality',min:0,max:10,weight:1}]}];data.evaluations=[{id:'e',cycleId:ids[2],activityId:ids[1],status:'submitted',scores:{quality:5},notes:'PRIVATE',approvedFeedback:'APPROVED',feedbackApprovedAt:'2026-10-02T00:00:00Z'}];
  const portal={...context,principal:{kind:'portal',id:ids[3]}};
  assert.deepEqual((await readWorkflow(portal,memory(data))).results,[]);
  data.cycles[0].state='released';const released=await readWorkflow(portal,memory(data));assert.deepEqual(released.results[0].feedback,['APPROVED']);assert.equal(JSON.stringify(released).includes('PRIVATE'),false);
  data.assignments[0].role='participant';assert.deepEqual((await readWorkflow(portal,memory(data))).results,[]);
  data.assignments[0].role='presenter';data.assignments[0].status='revoked';assert.deepEqual((await readWorkflow(portal,memory(data))).results,[]);
});
test('accepted legacy import only accepts bounded server-loaded source IDs and requires configure',async()=>{
  const input=cmd('importAcceptedItems',{itemIds:[ids[0]]});
  assert.equal((await executeWorkflowCommand(context,input,memory())).result.itemIds[0],ids[0]);
  for(const itemIds of [[],['bad'],[ids[0],ids[0]],Array.from({length:101},()=>ids[0])])await assert.rejects(executeWorkflowCommand(context,{...input,itemIds},memory()),{status:422});
  await assert.rejects(executeWorkflowCommand(context,{...input,items:[{title:'Injected'}]},memory()),{status:422});
  await assert.rejects(executeWorkflowCommand({...context,permission:'events.operations.record_create'},input,memory()),{status:403});
});
test('private correction histories require archive staff and remove unrelated server columns',async()=>{
  const store={...memory(),history:async()=>({attendanceRevisions:[{id:ids[0],attendanceId:ids[1],revision:2,status:'present',notes:'Correction',recordedAt:'2026-10-02T12:00:00+05:30',actorId:ids[2],tokenHash:'SECRET'}],evaluationRevisions:[{id:ids[2],evaluationId:ids[3],revision:1,scores:{quality:3},notes:'Private assessment',submittedAt:'2026-10-02T00:00:00Z',requestHash:'SECRET'}],truncated:false})};
  await assert.rejects(readWorkflowHistory({...context,principal:{kind:'portal',id:ids[3]}},store),{status:403});
  await assert.rejects(readWorkflowHistory(context,store),{status:403});
  const result=await readWorkflowHistory({...context,permission:'events.operations.record_archive'},store);assert.equal(result.attendanceRevisions[0].recordedAt,'2026-10-02T06:30:00.000Z');assert.equal(result.evaluationRevisions[0].notes,'Private assessment');assert.equal(JSON.stringify(result).includes('SECRET'),false);
  store.history=async()=>({attendanceRevisions:Array.from({length:501},()=>({id:ids[0]})),evaluationRevisions:[],truncated:false});const bounded=await readWorkflowHistory({...context,permission:'events.operations.record_archive'},store);assert.equal(bounded.attendanceRevisions.length,500);assert.equal(bounded.truncated,true);
});
