const fs=require('fs');
const p='src/execution-orchestrator/index.ts';
let s=fs.readFileSync(p,'utf8');
s=s.replace(/reduce\(\(s,t\)/g,'reduce((s:any,t:any)')
 .replace(/filter\(t=>/g,'filter((t:any)=>')
 .replace(/map\(t=>/g,'map((t:any)=>');
fs.writeFileSync(p,s);
