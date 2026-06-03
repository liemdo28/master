#!/usr/bin/env node
"use strict";
const path=require("path"),fs=require("fs");
let chalk;
try{chalk=require("chalk")}catch(_){const n=s=>s;chalk={bold:n,cyan:n,green:n,yellow:n,red:n,magenta:n,dim:n,bgGreen:n};}
const{bold,cyan,green,yellow,red,magenta,dim,bgGreen}=chalk;
const MASTER_INDEX=path.join(__dirname,"master-indexer","output","MASTER_INDEX.json");
const EVENTS_DIR=path.join(__dirname,"master-journal","events");
let masterIndex=null,journalEvents=[];
function loadAllData(){
  try{masterIndex=JSON.parse(fs.readFileSync(MASTER_INDEX,"utf8"));}catch(e){}
  try{
    if(fs.existsSync(EVENTS_DIR)){
      const files=fs.readdirSync(EVENTS_DIR).filter(f=>f.endsWith(".jsonl")).sort().reverse();
      for(const file of files.slice(0,3)){
        const c=fs.readFileSync(path.join(EVENTS_DIR,file),"utf8");
        c.trim().split("\n").forEach(line=>{try{journalEvents.push(JSON.parse(line));}catch(_){}});
      }
    }
  }catch(e){}
}
function fmtB(b){if(!b&&b!==0)return"N/A";if(b>=1e12)return(b/1e12).toFixed(2)+" TB";if(b>=1e9)return(b/1e9).toFixed(2)+" GB";if(b>=1e6)return(b/1e6).toFixed(2)+" MB";if(b>=1e3)return(b/1e3).toFixed(2)+" KB";return b+" B";}
function fmtD(iso){if(!iso)return"N/A";try{return new Date(iso).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})+" (ICT)";}catch(_){return iso;}}
function relT(iso){if(!iso)return"";const d=Date.now()-new Date(iso).getTime();const m=Math.floor(d/60000);const h=Math.floor(d/3600000);const dy=Math.floor(d/86400000);if(m<1)return"vua xong";if(m<60)return m+" phut truoc";if(h<24)return h+" gio truoc";return dy+" ngay truoc";}
function dv(len=80){return"\u2500".repeat(len);}
function pd(s,len){s=String(s);return s+" ".repeat(Math.max(0,len-s.length));}
function scr(name,q){
  const n=name.toLowerCase(),qq=q.toLowerCase();
  if(n===qq)return 100;
  if(n.startsWith(qq))return 90;
  if(n.includes(qq))return 70;
  let qi=0;
  for(let i=0;i<n.length&&qi<qq.length;i++){if(n[i]===qq[qi])qi++;}
  return qi===qq.length?40:0;
}

const H={
  help(){
    let o="\n"+bgGreen(" "+bold(" CEO SEARCH MVP ")+" ")+"\n\n"+dv()+"\n"+bold(cyan("  AVAILABLE COMMANDS"))+"\n"+dv()+"\n";
    const cmds=[
      ["summary","Tong quan he thong"],
      ["total projects","Dem so du an"],
      ["top N largest projects","N du an lon nhat"],
      ["top N biggest projects","N du an nang nhat"],
      ["projects without git","Khong co git"],
      ["projects depending on [x]","Phu thuoc [x]"],
      ["projects without qa","Khong co QA"],
      ["duplicate projects","Du an trung lap"],
      ["recent changes","Thay doi gan day"],
      ["project [name]","Chi tiet DNA"],
      ["language [lang]","Theo ngon ngu"],
      ["status [status]","Theo trang thai"],
      ["help","Huong dan"]
    ];
    const maxC=Math.max(...cmds.map(([c])=>c.length));
    for(const[cmd,desc]of cmds){o+="  "+bold(yellow(pd(cmd,maxC+2)))+dim(desc)+"\n";}
    o+=dv()+"\n"+dim("  Vi du: node ceo-search.js summary")+"\n"+dv()+"\n";
    o+="  Data: MASTER_INDEX.json\n  Index: "+(masterIndex?fmtD(masterIndex.generated_at):"N/A")+"\n\n";
    return o;
  },
  summary(){
    if(!masterIndex)return red("ERROR\n");
    const P=masterIndex.projects;
    const tF=masterIndex.total_files;
    const tL=masterIndex.total_lines;
    const tS=P.reduce((s,p)=>s+(p.size_bytes||0),0);
    const wG=P.filter(p=>p.git_remote).length;
    const langs={},fw={},hasQA=new Set();
    for(const p of P){
      langs[p.language_main]=(langs[p.language_main]||0)+1;
      if(p.framework)fw[p.framework]=(fw[p.framework]||0)+1;
      const deps=p.dependencies||[];
      const mods=(p.modules||[]).map(m=>m.name.toLowerCase());
      if(mods.some(n=>n.includes("test")||n.includes("qa"))||deps.some(d=>/playwright|jest|mocha|vitest|cypress|@testing/i.test(d.name)))hasQA.add(p.project_name);
    }
    const tL5=Object.entries(langs).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const tF5=Object.entries(fw).sort((a,b)=>b[1]-a[1]).slice(0,5);
    let o="\n"+bgGreen(" "+bold(" CEO SEARCH - Summary ")+" ")+"\n\n  "+bold(cyan("=== MASTER INTELLIGENCE ==="))+"\n  "+dv()+"\n";
    o+="  "+bold("Total Projects:  ")+green(bold(P.length+""))+"\n";
    o+="  "+bold("Total Files:     ")+green(bold(tF.toLocaleString()))+"\n";
    o+="  "+bold("Total Lines:     ")+green(bold(tL.toLocaleString()))+"\n";
    o+="  "+bold("Total Size:      ")+green(bold(fmtB(tS)))+"\n";
    o+="  "+dv()+"\n";
    o+="  "+bold("Git Connected:   ")+green(wG+"")+"\n";
    o+="  "+bold("Git Missing:     ")+yellow((P.length-wG)+"")+"\n";
    o+="  "+bold("QA Covered:      ")+green(hasQA.size+"")+"\n";
    o+="  "+bold("No QA:           ")+yellow((P.length-hasQA.size)+"")+"\n";
    o+="  "+dv()+"\n";
    o+="  "+bold(cyan("Languages (top 5):"))+"\n";
    for(const[l,c]of tL5){o+="  "+pd(l||"Unknown",15)+green("#".repeat(Math.min(c,20)))+" "+cyan(c+"")+"\n";}
    if(tF5.length>0){o+="  "+dv()+"\n  "+bold(cyan("Frameworks:"))+"\n";for(const[f,c]of tF5){o+="  "+pd(f,15)+magenta("#".repeat(Math.min(c,20)))+" "+cyan(c+"")+"\n";}}
    o+="  "+dv()+"\n  "+dim("Index: "+fmtD(masterIndex.generated_at))+"\n\n";
    return o;
  },
  totalProjects(){
    if(!masterIndex)return red("ERROR\n");
    return"\n"+green(bold("  Tong so du an: "+masterIndex.projects.length+" projects\n"))+"\n";
  },
  topLargest(q){
    if(!masterIndex)return red("ERROR\n");
    const byFile=/largest/i.test(q);
    const m=q.match(/top\s+(\d+)/i);
    const n=m?Math.min(parseInt(m[1]),50):10;
    const sorted=[...masterIndex.projects].sort((a,b)=>byFile?(b.total_files||0)-(a.total_files||0):(b.size_bytes||0)-(a.size_bytes||0)).slice(0,n);
    const metric=byFile?"Files":"Size";
    let o="\n"+cyan(bold("  === Top "+n+" (by "+metric+") ==="))+"\n  "+dv()+"\n  "+pd("#",3)+pd("Project",50)+pd(metric,12)+"Lang\n  "+dv()+"\n";
    sorted.forEach((p,i)=>{
      const val=byFile?p.total_files.toLocaleString():fmtB(p.size_bytes);
      const row="  "+pd((i+1)+".",3)+pd(p.display_name,50)+pd(val,12)+(p.language_main||"?");
      o+=(i<3?green(row):cyan(row))+"\n";
    });
    o+="  "+dv()+"\n";
    return o+"\n";
  },
  withoutGit(){
    if(!masterIndex)return red("ERROR");
    const missing=masterIndex.projects.filter(p=>!p.git_remote);
    let o=""+yellow(bold("  === Projects WITHOUT Git ("+missing.length+") ==="))+"\n  "+dv()+"\n";
    missing.forEach((p,i)=>{o+="  "+yellow((i+1)+". ")+bold(p.display_name)+"\n     "+dim("Path: "+p.path)+"\n";});
    o+="  "+dv()+"\n";
    return o+"\n";
  },
  dependingOn(q){
    if(!masterIndex)return red("ERROR");
    const m=q.match(/depending\s+on\s+(.+)/i);
    if(!m)return red("Usage: projects depending on [name]\n");
    const target=m[1].trim().toLowerCase();
    const matches=[];
    for(const p of masterIndex.projects){
      const deps=p.dependencies||[];
      const hit=deps.find(d=>d.name.toLowerCase().includes(target));
      if(hit)matches.push({project:p,dep:hit});
    }
    let o="\n"+cyan(bold("  === Projects Depending on '"+target+"' ("+matches.length+") ==="))+"\n  "+dv()+"\n";
    if(matches.length===0){o+=dim("  None found.\n");}
    else{matches.forEach(({project:p,dep},i)=>{o+="  "+green((i+1)+". ")+bold(p.display_name)+"\n     "+dim(dep.version+" "+dep.type+(dep.is_dev?" [dev]":""))+"\n";});}
    o+="  "+dv()+"\n";
    return o+"\n";
  },
  withoutQA(){
    if(!masterIndex)return red("ERROR");
    const noQA=[];
    for(const p of masterIndex.projects){
      const deps=p.dependencies||[];
      const mods=(p.modules||[]).map(m=>m.name.toLowerCase());
      const qM=mods.filter(n=>n.includes("test")||n.includes("qa"));
      const qD=deps.filter(d=>/playwright|jest|mocha|vitest|cypress|@testing|supertest/i.test(d.name));
      if(qM.length===0&&qD.length===0)noQA.push(p);
    }
    let o="\n"+yellow(bold("  === Projects WITHOUT QA ("+noQA.length+") ==="))+"\n  "+dv()+"\n";
    if(noQA.length===0){o+=green("  All have QA!\n");}
    else{noQA.forEach((p,i)=>{o+="  "+yellow((i+1)+". ")+bold(p.display_name)+dim(" ["+p.language_main+"]")+"\n";});}
    o+="  "+dv()+"\n";
    return o+"\n";
  },
  duplicates(){
    if(!masterIndex)return red("ERROR");
    const projects=masterIndex.projects;
    const byPrefix={};
    for(const p of projects){
      const parts=p.project_name.split(/[-_]/);
      const prefix=parts.slice(0,2).join("-");
      if(!byPrefix[prefix])byPrefix[prefix]=[];
      byPrefix[prefix].push(p);
    }
    const prefixGroups=Object.entries(byPrefix).filter(([_,v])=>v.length>1);
    let o="\n"+magenta(bold("  === Duplicate / Similar Projects ==="))+"\n  "+dv()+"\n";
    if(prefixGroups.length===0){o+=green("  No duplicates.\n");}
    else{for(const[prefix,projs]of prefixGroups){
      o+="  "+dim(prefix+"* ("+projs.length+")")+"\n";
      projs.forEach(p=>{o+="    - "+p.display_name+dim(" ["+p.language_main+"]")+"\n";});
    }}
    o+="  "+dv()+"\n";
    return o+"\n";
  },
  recentChanges(){
    if(!masterIndex)return red("ERROR");
    const sorted=[...masterIndex.projects].sort((a,b)=>new Date(b.last_indexed||0)-new Date(a.last_indexed||0));
    let o="\n"+cyan(bold("  === Recently Indexed ==="))+"\n  "+dv()+"\n  "+pd("#",3)+pd("Project",45)+"Last Indexed\n  "+dv()+"\n";
    sorted.slice(0,15).forEach((p,i)=>{
      const row="  "+pd((i+1)+".",3)+pd(p.display_name,45)+fmtD(p.last_indexed).substring(0,20);
      o+=(i<5?green(row):cyan(row))+"\n";
    });
    o+="  "+dv()+"\n";
    return o+"\n";
  },
  projectDetail(q){
    if(!masterIndex)return red("ERROR");
    const m=q.match(/^project\s+(.+)/i);
    if(!m)return red("Usage: project [name]\n");
    const target=m[1].trim().toLowerCase();
    const scored=masterIndex.projects.map(p=>({p,score:Math.max(scr(p.project_name,target),scr(p.display_name,target))})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
    if(scored.length===0)return red("  Not found: '"+target+"'\n");
    const p=scored[0].p;
    const deps=p.dependencies||[];
    const dD=deps.filter(d=>d.is_dev);
    const pD=deps.filter(d=>!d.is_dev);
    const modules=p.modules||[];
    let o="\n"+bgGreen(" "+bold(" PROJECT DNA: "+p.display_name+" ")+" ")+"\n  "+dv()+"\n";
    o+="  "+bold("Name:       ")+green(p.project_name)+"\n";
    o+="  "+bold("Path:       ")+dim(p.path)+"\n";
    o+="  "+bold("Status:     ")+(p.status==="active"?green("ACTIVE"):yellow(p.status))+"\n";
    o+="  "+bold("Language:   ")+green(p.language_main||"?")+"\n";
    o+="  "+bold("Framework:  ")+(p.framework||dim("None"))+"\n";
    o+="  "+dv()+"\n  "+bold(cyan("=== Git ==="))+"\n";
    if(p.git_remote){o+="  "+bold("Remote:     ")+green(p.git_remote)+"\n";o+="  "+bold("Branch:     ")+(p.git_branch||"?")+"\n";}
    else{o+=yellow("  No Git remote!")+"\n";}
    o+="  "+dv()+"\n  "+bold(cyan("=== Metrics ==="))+"\n";
    o+="  "+bold("Files:      ")+green((p.total_files||0).toLocaleString())+"\n";
    o+="  "+bold("Lines:      ")+green((p.total_lines||0).toLocaleString())+"\n";
    o+="  "+bold("Size:       ")+green(fmtB(p.size_bytes))+"\n";
    o+="  "+bold("Modified:   ")+fmtD(p.last_modified)+"\n";
    o+="  "+bold("Indexed:    ")+fmtD(p.last_indexed)+"\n";
    o+="  "+dv()+"\n  "+bold(cyan("=== Deps ("+deps.length+") ==="))+"\n";
    if(pD.length>0)o+="  Prod("+pD.length+"): "+dim(pD.slice(0,8).map(d=>d.name).join(", "))+"\n";
    if(dD.length>0)o+="  Dev("+dD.length+"): "+dim(dD.slice(0,8).map(d=>d.name).join(", "))+"\n";
    if(modules.length>0){o+="  "+dv()+"\n  "+bold(cyan("=== Modules ("+modules.length+") ==="))+"\n";for(const mod of modules.slice(0,10)){o+="    "+dim(mod.name+" ["+mod.file_count+" files]")+"\n";}}
    o+="  "+dv()+"\n";
    return o+"\n";
  },
  byLanguage(q){
    if(!masterIndex)return red("ERROR");
    const m=q.match(/language\s+(.+)/i);
    if(!m)return red("Usage: language [name]\n");
    const lang=m[1].trim().toLowerCase();
    const matches=masterIndex.projects.filter(p=>(p.language_main||"").toLowerCase().includes(lang)||(p.language_secondary||"").toLowerCase().includes(lang));
    let o="\n"+cyan(bold("  === Language: "+lang+" ("+matches.length+") ==="))+"\n  "+dv()+"\n";
    matches.forEach((p,i)=>{o+="  "+green((i+1)+". ")+bold(p.display_name)+dim(" ["+p.language_main+"]")+"\n";});
    o+="  "+dv()+"\n";
    return o+"\n";
  },
  byStatus(q){
    if(!masterIndex)return red("ERROR");
    const m=q.match(/status\s+(.+)/i);
    if(!m)return red("Usage: status [active]\n");
    const st=m[1].trim().toLowerCase();
    const matches=masterIndex.projects.filter(p=>(p.status||"").toLowerCase()===st);
    let o="\n"+cyan(bold("  === Status: "+st+" ("+matches.length+") ==="))+"\n  "+dv()+"\n";
    matches.forEach((p,i)=>{o+="  "+green((i+1)+". ")+bold(p.display_name)+"\n";});
    o+="  "+dv()+"\n";
    return o+"\n";
  },
  defaultHandler(q){
    if(!masterIndex)return red("ERROR");
    const scored=masterIndex.projects.map(p=>({p,score:scr(p.project_name,q)||scr(p.display_name,q)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,5);
    let o="\n"+yellow("  Not recognized: '"+q+"'")+"\n  Run: node ceo-search.js help\n";
    if(scored.length>0){o+="\n  Did you mean:\n";scored.forEach(({p},i)=>{o+="  "+(i+1)+". "+bold(p.display_name)+"\n";});}
    return o+"\n";
  }
};

function route(q){
  const query=(q||"").trim();
  if(!query)return H.help();
  if(/^(help|\?)$/i.test(query))return H.help();
  if(/^summary$/i.test(query))return H.summary();
  if(/^total\s+projects$/i.test(query))return H.totalProjects();
  if(/^top\s+\d+\s+(largest|biggest)\s+projects$/i.test(query))return H.topLargest(query);
  if(/^projects\s+without\s+git$/i.test(query))return H.withoutGit();
  if(/^projects\s+depending\s+on\s+/i.test(query))return H.dependingOn(query);
  if(/^projects\s+without\s+qa$/i.test(query))return H.withoutQA();
  if(/^duplicate\s+projects$/i.test(query))return H.duplicates();
  if(/^recent\s+changes$/i.test(query))return H.recentChanges();
  if(/^project\s+/i.test(query))return H.projectDetail(query);
  if(/^language\s+/i.test(query))return H.byLanguage(query);
  if(/^status\s+/i.test(query))return H.byStatus(query);
  return H.defaultHandler(query);
}

loadAllData();
const query=process.argv.slice(2).join(" ").trim();
process.stdout.write(route(query));
