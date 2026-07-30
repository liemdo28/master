// phase-38-finance-accounting-os - Phase 38. Modules: GL + AP/AR + reconciliation + tax
// OSS: governed per mi-core/server/src/oss-runtime/oss-worker-registry.ts
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class FinanceAccountingOS {
  constructor(opts={}) {
    this.registry=new JsonStore('ph38-reg',opts);
    this.signals=new JsonStore('ph38-sig',opts);
    this.alerts=new JsonStore('ph38-alr',opts);
  }
  register(s){
    const r={id:makeId('S38'),timestamp:Date.now(),signal:s.signal||s,status:'open',
      approvalRequired:!!(s.requiresApproval),assignedTo:s.assignedTo||null};
    this.signals.insert(r);return r;
  }
  approve(id){
    const r=this.signals.find(x=>x.id===id);
    if(r){this.signals.update(r.id,{status:'approved',approvedAt:Date.now()});return this.signals.find(x=>x.id===id);}
    return r;
  }
  reject(id){
    const r=this.signals.find(x=>x.id===id);
    if(r){this.signals.update(r.id,{status:'rejected',rejectedAt:Date.now()});return this.signals.find(x=>x.id===id);}
    return r;
  }
  escalate(id,reason){
    const r=this.signals.find(x=>x.id===id);
    if(r){this.signals.update(r.id,{status:'escalated',escalatedAt:Date.now(),reason});return this.signals.find(x=>x.id===id);}
    return r;
  }
  pending(){return this.signals.filter(x=>x.status==='open');}
  escalated(){return this.signals.filter(x=>x.status==='escalated');}
  alert(level,msg,ref){
    return this.alerts.insert({id:makeId('ALR'),timestamp:Date.now(),level,message:msg,ref:ref||null,acknowledged:false});
  }
  acknowledgeAlert(id){
    const a=this.alerts.find(x=>x.id===id);
    if(a){this.alerts.update(a.id,{acknowledged:true,acknowledgedAt:Date.now()});return this.alerts.find(x=>x.id===id);}
    return a;
  }
  dashboard(){
    const s=this.signals.all();const a=this.alerts.all();
    const open=s.filter(x=>x.status==='open').length;
    const esc=s.filter(x=>x.status==='escalated').length;
    const crit=a.filter(x=>x.level==='critical'&&!x.acknowledged).length;
    return{phase:38,cls:'FinanceAccountingOS',total:s.length,open,escalated:esc,criticalAlerts:crit,
      status:crit>0?'CRITICAL':esc>3?'BUSY':open>5?'ACTIVE':'NORMAL'};
  }
}

export class FinanceAccountingOSOrchestrator{constructor(opts={}){this.os=new FinanceAccountingOS(opts);}dashboard(){return this.os.dashboard();}}
export default FinanceAccountingOSOrchestrator;
