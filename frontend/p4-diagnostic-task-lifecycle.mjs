// Auditable state transitions for research-only follow-up tasks.
// No background scheduling, live orders, or model mutation.
export function createP4DiagnosticTaskRecord(plan,{taskId,createdAtMs}={}){
 if(!plan||plan.schemaVersion!=='P4_DIAGNOSTIC_FOLLOW_UP_PLAN_V1'||plan.status!=='PROPOSED_NOT_EXECUTED'||plan.researchOnly!==true||plan.autoExecutionAuthorized!==false||plan.ordersEnabled!==false||plan.modelUpdateAllowed!==false||plan.championPromotionAllowed!==false)throw Error('unsafe diagnostic follow-up plan');
 if(typeof taskId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(taskId)||!Number.isSafeInteger(createdAtMs)||createdAtMs<0)throw Error('invalid diagnostic task identity');
 return {schemaVersion:'P4_DIAGNOSTIC_TASK_RECORD_V1',taskId,sourceJobId:plan.sourceJobId,plan,status:'PROPOSED',attempt:0,createdAtMs,updatedAtMs:createdAtMs,executionJobId:null,resultJobId:null,ordersEnabled:false,modelUpdateAllowed:false,championPromotionAllowed:false};
}
export function transitionP4DiagnosticTask(record,{to,atMs,executionJobId,resultJobId}={}){
 if(!record||record.schemaVersion!=='P4_DIAGNOSTIC_TASK_RECORD_V1'||record.ordersEnabled!==false||record.modelUpdateAllowed!==false||record.championPromotionAllowed!==false||!Number.isSafeInteger(record.attempt)||record.attempt<0||!Number.isSafeInteger(atMs)||atMs<=record.updatedAtMs)throw Error('invalid diagnostic task transition');
 const allowed={PROPOSED:['READY','CANCELLED'],READY:['RUNNING','CANCELLED'],RUNNING:['COMPLETED','FAILED'],FAILED:['READY','CANCELLED'],COMPLETED:[],CANCELLED:[]};
 if(!allowed[record.status]?.includes(to))throw Error('forbidden diagnostic task transition');
 if(to==='RUNNING'&&(typeof executionJobId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(executionJobId)))throw Error('execution job ID required');
 if(to==='COMPLETED'&&(typeof resultJobId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(resultJobId)))throw Error('result job ID required');
 if(to==='RUNNING'&&record.executionJobId===executionJobId)throw Error('execution attempt must use new job ID');
 return {...record,status:to,updatedAtMs:atMs,attempt:to==='RUNNING'?record.attempt+1:record.attempt,executionJobId:to==='RUNNING'?executionJobId:record.executionJobId,resultJobId:to==='COMPLETED'?resultJobId:record.resultJobId};
}
