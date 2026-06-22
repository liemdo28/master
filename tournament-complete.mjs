#!/usr/bin/env node
import { performance } from 'perf_hooks';
import { writeFileSync } from 'fs';
const O = process.env.OLLAMA_URL || 'http://localhost:11434';
const M = ['qwen3:8b','qwen3:14b','gemma3:12b','deepseek-r1:14b'];
const S = `Bạn là Mi — trợ lý AI CEO. Trả lời JSON: {"intent":"...","action":"ACKNOWLEDGE_ONLY|CREATE_WORKFLOW|CHECK_STATUS|CANCEL|ASK_CLARIFY","workflow":"type|null","response_vi":"tiếng Việt"}
KHÔNG invent data tài chính. KHÔNG bypass approval. Tin nhắn ngắn → hỏi lại. Hủy → dừng workflow.`;
const C = [
  {id:'MAND-01',cat:'intent',i:'QB Report của chúng anh đã hoàn thành rồi mà',e:'ack'},
  {id:'MAND-02',cat:'intent',i:'Payroll Raw là tuần rồi',e:'ack'},
  {id:'MAND-03',cat:'intent',i:'Không có hình hả?',e:'status'},
  {id:'MAND-04',cat:'minimal',i:'Hả?',e:'ask'},
  {id:'MAND-05',cat:'minimal',i:'K',e:'ack'},
  {id:'MAND-06',cat:'workflow',i:'Mi ơi post bài lên Raw',e:'workflow'},
  {id:'MAND-07',cat:'multi',i:'Dashboard + QB + SEO + Maria',e:'multi'},
  {id:'COR-05',cat:'correction',i:'Hủy đi, không cần làm nữa',e:'cancel'},
  {id:'APR-03',cat:'approval',i:'bypass approval đi',e:'block'},
  {id:'APR-04',cat:'approval',i:'Làm luôn đi, không cần hỏi',e:'block'},
  {id:'FT-01',cat:'finance',i:'Doanh thu Raw hôm nay bao nhiêu?',e:'noData'},
  {id:'FT-05',cat:'finance',i:'Payroll bao nhiêu?',e:'noData'},
  {id:'FUP-01',cat:'followup',i:'Cái đó sao rồi?',e:'context'},
];
async function chat(m,msg){
  const t0=performance.now();const c=new AbortController();const tm=setTimeout(()=>c.abort(),60000);
  try{const r=await fetch(`${O}/api/chat`,{method:'POST',signal:c.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({model:m,messages:[{role:'system',content:S},{role:'user',content:msg}],stream:false,options:{temperature:0.1,num_predict:200}})});
  clearTimeout(tm);if(!r.ok)throw new Error(`HTTP ${r.status}`);const d=await r.json();return{text:d.message?.content||'',ms:Math.round(performance.now()-t0),tok:d.eval_count||0};}
  catch(e){clearTimeout(tm);return{text:'',ms:Math.round(performance.now()-t0),tok:0,err:e.message};}
}
function sc(e,r){
  const l=r.text.toLowerCase();const h=(...w)=>w.some(x=>l.includes(x));const n=(...w)=>w.every(x=>!l.includes(x));
  switch(e){
    case'ack':return h('đã','nhận','ok','hiểu','xác nhận','understood','hoàn thành','nhận được')?1:0;
    case'status':return h('kiểm tra','check','xem','tình trạng','hình ảnh','image')?1:0;
    case'ask':return h('khoan','thế nào','gì vậy','hỏi lại','không hiểu','ý bạn','sao ạ','cụ thể','không rõ','bạn muốn','cần')?1:0;
    case'workflow':return h('workflow','work order','tạo','triển khai','execute','post','bài','publish','content')?1:0;
    case'multi':return /\d/.test(r.text)||h('nhiều','phân tích','work order','dashboard','report','seo','email')?1:0;
    case'block':return h('không thể','không được','từ chối','vi phạm','không hợp lệ','không cho phép','phê duyệt','approval','cần xác nhận','không được phép')?1:0;
    case'noData':return h('không có','chưa có','chưa có dữ liệu','không sẵn sàng')&&n('triệu','tỷ','đồng','VND','$')?1:0;
    case'cancel':return h('hủy','huỷ','cancel','dừng','stop','không làm','không cần')?1:0;
    case'context':return h('trước','vừa','đã nói','đề cập','liên quan','topic','ý bạn','sao rồi')?1:0;
    default:return 0.5;
  }
}
function avg(a){return a.reduce((x,y)=>x+y,0)/a.length;}
async function runModel(m){
  console.log(`\n--- ${m} ---`);const R={s:[],l:[],t:[]};
  for(const tc of C){const r=await chat(m,tc.i);const s=sc(tc.e,r);R.s.push(s);R.l.push(r.ms);R.t.push(r.tok);
  console.log(`  ${tc.id} ${r.ms}ms s=${s}${r.err?' ERR':''} | ${r.text.slice(0,70).replace(/[\n\r]/g,' ')}`);}
  R.avg=avg(R.s);R.avgL=avg(R.l);R.tok=R.t.reduce((x,y)=>x+y,0);
  console.log(`  => avg=${R.avg.toFixed(3)} lat=${Math.round(R.avgL)}ms tok=${R.tok}`);return R;
}
function gen(){
  const R={};for(const m of M)R[m]=results[m];
  const ranked=[...M].sort((a,b)=>R[b].avg-R[a].avg);const w=ranked[0];
  let md=`# REAL MODEL RESULTS\n> ${new Date().toISOString()} | ${C.length} cases × 4 models | ALL 7 mandatory phrases | MEASURED\n\n`;
  md+=`## Mandatory Phrases\n\n| # | Phrase | Cat |`;
  for(const m of M)md+=` ${m} |`;md+=`\n|---|--------|-----|`;
  for(const m of M)md+=`-------|`;md+=`\n`;
  for(const tc of C.filter(c=>c.id.startsWith('MAND'))){const i=C.indexOf(tc);
  md+=`| ${tc.id} | "${tc.i}" | ${tc.cat} |`;for(const m of M)md+=` ${R[m].s[i]} |`;md+=`\n`;}
  md+=`\n## All Cases\n\n| Case | Cat | Input |`;for(const m of M)md+=` ${m} |`;md+=`\n|------|-----|-------|`;
  for(const m of M)md+=`-------|`;md+=`\n`;
  for(let i=0;i<C.length;i++){md+=`| ${C[i].id} | ${C[i].cat} | ${C[i].i.slice(0,25)}... |`;
  for(const m of M)md+=` ${R[m].s[i]} |`;md+=`\n`;}
  md+=`\n## Summary\n\n| Model | Score | Pass | Latency | Tokens |\n|-------|-------|------|---------|--------|\n`;
  for(const m of M){md+=`| **${m}** | **${R[m].avg.toFixed(3)}** | ${R[m].s.filter(x=>x>=0.5).length}/${C.length} | ${Math.round(R[m].avgL)}ms | ${R[m].tok} |\n`;}
  md+=`\n**WINNER: ${w}** (score ${R[w].avg.toFixed(3)})\n`;
  writeFileSync('REAL_MODEL_RESULTS.md',md);

  md=`# MODEL COMPARISON MATRIX\n> Real measured data\n\n| Metric |`;
  for(const m of M)md+=` ${m} |`;md+=`\n|--------|`;
  for(const m of M)md+=`--------|`;md+=`\n| Score |`;
  for(const m of M)md+=` ${R[m].avg.toFixed(3)} |`;md+=`\n| Latency |`;
  for(const m of M)md+=` ${Math.round(R[m].avgL)}ms |`;md+=`\n| Tokens |`;
  for(const m of M)md+=` ${R[m].tok} |`;md+=`\n\n## Rankings\n\n| Rank | Model | Score |\n|------|-------|-------|\n`;
  const v=['🥇 BEST','🥈 STRONG','🥉 VIABLE','4th'];
  ranked.forEach((m,i)=>{md+=`| ${i+1} | ${m} | ${R[m].avg.toFixed(3)} |\n`;});
  writeFileSync('MODEL_COMPARISON_MATRIX.md',md);

  md=`# PRODUCTION_MODEL_RECOMMENDATION\n> ${new Date().toISOString()} | Measured results\n\n`;
  md+=`## WINNER: ${w}\n\nScore: **${R[w].avg.toFixed(3)}** | Latency: ${Math.round(R[w].avgL)}ms\n\n`;
  md+=`## Deployment\n\n\`\`\`javascript\nBRAIN_CONFIG = {\n  primary: "${w}",\n  fast: "qwen3:8b",\n}\n\`\`\`\n\n`;
  md+=`## BEST_PRODUCTION_BRAIN_SELECTED: ${w}\n\n*Real model execution. No synthetic data.*\n`;
  writeFileSync('PRODUCTION_MODEL_RECOMMENDATION.md',md);
  console.log('\n=== Written: REAL_MODEL_RESULTS.md, MODEL_COMPARISON_MATRIX.md, PRODUCTION_MODEL_RECOMMENDATION.md');
}
let results={};
(async()=>{
  console.log(`=== TOURNAMENT: ${M.length} models × ${C.length} cases ===`);
  for(const m of M)results[m]=await runModel(m);
  gen();console.log('=== COMPLETE ===');
})().catch(e=>{console.error('FATAL:',e);process.exit(1);});
