import { isObject, RESERVED_KEYS, STABLE_KEY } from '../contracts.js';
import { OperationsError } from '../errors.js';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const roles = ['presenter','evaluator','staff','volunteer','participant'];
export const fail = (message='Invalid workflow input.') => { throw new OperationsError('invalid_input',422,message); };
export const forbidden = () => { throw new OperationsError('forbidden',403,'You cannot perform this action.'); };
export function exact(value,keys) { if(!isObject(value)||Object.keys(value).some(k=>!keys.includes(k))) fail(); }
export function uuid(value) { if(typeof value!=='string'||!UUID.test(value)) fail('Enter a valid ID.'); return value; }
function optionalId(value) { if(value!==undefined&&value!==null) uuid(value); }
export function text(value,max=200,blank=false) {if(typeof value!=='string'||value.length>max||(!blank&&!value.trim())) fail('Enter valid text.');return value;}
function enumValue(value,values) {if(!values.includes(value)) fail();}
function optionalEnum(value,values) {if(value!==undefined) enumValue(value,values);}
function integer(value,min,max=1000000) {if(!Number.isSafeInteger(value)||value<min||value>max) fail('Enter a valid integer.');}
export function date(value) {
  if(value===undefined||value===null)return;
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value))) fail('Use an ISO timestamp with timezone offset.');
  const [year,month,day] = value.slice(0,10).split('-').map(Number);
  if(month<1||month>12||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate())fail('Enter a real calendar date.');
}
function interval(start,end) {date(start);date(end);if(Boolean(start)!==Boolean(end)||(start&&Date.parse(start)>=Date.parse(end)))fail('Use a paired increasing time interval.');}
function email(value) {text(value,254,true);if(value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))fail('Enter a valid email.');}
const personKeys=['id','name','email','contactId','roles'];
const activityKeys=['id','title','kind','resourceId','parentId','startsAt','endsAt','timezone','capacity'];
function person(p) {exact(p,personKeys);optionalId(p.id);text(p.name);email(p.email);optionalId(p.contactId);if(p.roles!==undefined&&(!Array.isArray(p.roles)||p.roles.length>5||new Set(p.roles).size!==p.roles.length||p.roles.some(x=>!roles.includes(x))))fail();}
function activity(p) {exact(p,activityKeys);optionalId(p.id);text(p.title);text(p.kind,100);optionalId(p.resourceId);optionalId(p.parentId);interval(p.startsAt,p.endsAt);text(p.timezone,100);try{new Intl.DateTimeFormat('en',{timeZone:p.timezone});}catch{fail('Enter a valid IANA timezone.');}if(p.capacity!==undefined&&p.capacity!==null)integer(p.capacity,1);}
export const payloadKeys = Object.freeze({
  enableWorkflow:[],savePerson:personKeys,saveResource:['id','name','kind','capacity','location','availableFrom','availableUntil'],saveActivity:activityKeys,
  saveAssignment:['id','activityId','personId','role','cycleId','dueAt','status'],publishProgramme:[],acknowledgePlacement:['releaseId','activityId'],invite:['personId','expiresInDays'],revokeInvitation:['invitationId'],acceptInvitation:['tokenHash'],linkStaff:['personId','userId'],saveCycle:['id','title','rubric','state','dueAt'],releaseResults:['cycleId'],reopenEvaluation:['evaluationId','reason'],approveFeedback:['evaluationId','feedback'],saveEvaluation:['assignmentId','scores','notes','submit'],markAttendance:['activityId','personId','purpose','status','notes'],saveTask:['id','title','personId','activityId','dueAt','status'],completeTask:['taskId'],importPeople:['items'],importActivities:['items'],importAcceptedItems:['itemIds'],retryNotice:['noticeId'],queueReminders:[],
});
export function validateWorkflowInput(input) {
  if(!isObject(input)||!Object.hasOwn(payloadKeys,input.action))fail('Unknown workflow action.');
  exact(input,['action','expectedRevision','commandId',...payloadKeys[input.action]]);
  integer(input.expectedRevision,0,Number.MAX_SAFE_INTEGER);uuid(input.commandId);
  const p=Object.fromEntries(payloadKeys[input.action].filter(k=>input[k]!==undefined).map(k=>[k,input[k]]));
  switch(input.action){
    case 'savePerson':person(p);break;
    case 'saveActivity':activity(p);break;
    case 'saveResource':optionalId(p.id);text(p.name);enumValue(p.kind,['room','equipment']);integer(p.capacity,1);if(p.location!==undefined)text(p.location,1000,true);interval(p.availableFrom,p.availableUntil);break;
    case 'saveAssignment':optionalId(p.id);uuid(p.activityId);uuid(p.personId);enumValue(p.role,roles);optionalId(p.cycleId);date(p.dueAt);optionalEnum(p.status,['active','revoked']);break;
    case 'acknowledgePlacement':uuid(p.releaseId);uuid(p.activityId);break;
    case 'invite':uuid(p.personId);if(p.expiresInDays!==undefined)integer(p.expiresInDays,1,14);break;
    case 'revokeInvitation':uuid(p.invitationId);break;
    case 'acceptInvitation':if(typeof p.tokenHash!=='string'||!/^[a-f0-9]{64}$/.test(p.tokenHash))fail();break;
    case 'linkStaff':uuid(p.personId);uuid(p.userId);break;
    case 'saveCycle':{
      optionalId(p.id);text(p.title);optionalEnum(p.state,['draft','open','closed','released']);date(p.dueAt);
      if(!Array.isArray(p.rubric)||!p.rubric.length||p.rubric.length>20)fail('Use 1–20 rubric criteria.');
      const seen=new Set();for(const c of p.rubric){exact(c,['id','label','min','max','weight']);if(typeof c.id!=='string'||!STABLE_KEY.test(c.id)||RESERVED_KEYS.has(c.id)||seen.has(c.id))fail();seen.add(c.id);text(c.label);if([c.min,c.max,c.weight].some(n=>typeof n!=='number'||!Number.isFinite(n))||c.max<=c.min||c.weight<=0)fail('Use finite increasing rubric ranges and positive weights.');}break;
    }
    case 'releaseResults':uuid(p.cycleId);break;
    case 'reopenEvaluation':uuid(p.evaluationId);text(p.reason,2000);break;
    case 'approveFeedback':uuid(p.evaluationId);text(p.feedback,10000,true);break;
    case 'importAcceptedItems':if(!Array.isArray(p.itemIds)||!p.itemIds.length||p.itemIds.length>100||new Set(p.itemIds).size!==p.itemIds.length)fail('Select 1–100 distinct accepted submissions.');p.itemIds.forEach(uuid);break;
    case 'saveEvaluation':uuid(p.assignmentId);if(!isObject(p.scores)||Object.keys(p.scores).length>20||Object.entries(p.scores).some(([k,n])=>RESERVED_KEYS.has(k)||typeof n!=='number'||!Number.isFinite(n)))fail('Use finite rubric scores.');if(p.notes!==undefined)text(p.notes,10000,true);if(p.submit!==undefined&&typeof p.submit!=='boolean')fail();break;
    case 'markAttendance':uuid(p.activityId);uuid(p.personId);enumValue(p.purpose,['delivery','participation']);enumValue(p.status,['present','absent','excused']);if(p.notes!==undefined)text(p.notes,10000,true);break;
    case 'saveTask':optionalId(p.id);text(p.title);optionalId(p.personId);optionalId(p.activityId);date(p.dueAt);optionalEnum(p.status,['open','complete']);break;
    case 'completeTask':uuid(p.taskId);break;
    case 'importPeople':case 'importActivities':{
      if(!Array.isArray(p.items)||!p.items.length||p.items.length>100)fail('Import 1–100 rows per command.');const seen=new Set();
      for(const item of p.items){(input.action==='importPeople'?person:activity)(item);if(item.id){if(seen.has(item.id))fail('Duplicate import ID.');seen.add(item.id);}}
      if(input.action==='importPeople'){const contacts=p.items.map(x=>x.contactId).filter(Boolean);if(new Set(contacts).size!==contacts.length)fail('Duplicate contact.');}break;
    }
    case 'retryNotice':uuid(p.noticeId);break;
  }
  return {action:input.action,expectedRevision:input.expectedRevision,commandId:input.commandId,...p};
}
const configure=new Set(['enableWorkflow','publishProgramme','invite','revokeInvitation','linkStaff','saveCycle','releaseResults','reopenEvaluation','approveFeedback','importAcceptedItems','retryNotice','queueReminders']);
export function workflowPermission(input) {
  if(configure.has(input?.action))return 'events.operations.configure';
  if(!Object.hasOwn(payloadKeys,input?.action??'')||input.action==='acceptInvitation')fail('Unknown staff workflow action.');
  const importingIds=['importPeople','importActivities'].includes(input.action)&&Array.isArray(input.items)&&input.items.some(item=>item?.id);
  return `events.operations.${input.id||importingIds||['saveEvaluation','markAttendance','acknowledgePlacement','completeTask'].includes(input.action)?'record_update':'record_create'}`;
}
