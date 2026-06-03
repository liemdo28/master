import os, json
from datetime import datetime
BASE = "e:/Project/Master/dependency-engine"
INDEX = "e:/Project/Master/master-indexer/output/MASTER_INDEX.json"
idx = json.load(open(INDEX))
projects = idx["projects"]
project_names = set(p["project_name"] for p in projects)
import ntpath
dir_names = {ntpath.basename(p["path"]):p["project_name"] for p in projects}
all_internal_names = project_names.union(set(dir_names.keys()))
dependeeCount = {}
nodes = []
for p in projects:
  prod = [d for d in p["dependencies"] if not d["is_dev"]]
  internal = [d for d in prod if d["name"] in all_internal_names]
  external = [d for d in prod if d["name"] not in all_internal_names]
  nodes.append({"id":p["project_name"],"display_name":p["display_name"],"path":p["path"],"language":p["language_main"],"framework":p["framework"],"criticality":p["criticality"],"status":p["status"],"total_files":p["total_files"],"total_lines":p["total_lines"],"prod_dep_count":len(prod),"dev_dep_count":len([d for d in p["dependencies"] if d["is_dev"]]),"internal_deps":[{"name":d["name"],"version":d["version"]} for d in internal],"external_deps":[{"name":d["name"],"version":d["version"]} for d in external],"impact_score":len(internal)})
  for dep in internal:
    dependeeCount[dep["name"]]=dependeeCount.get(dep["name"],0)+1
for node in nodes:
  node["dependents_count"]=dependeeCount.get(node["id"],0)
edges=[{"from":node["id"],"to":d["name"],"type":"internal","version":d["version"]} for node in nodes for d in node["internal_deps"]]
mi=max([len(node["internal_deps"]) for node in nodes]+[0])
me=max([len(node["external_deps"]) for node in nodes]+[0])
md=max(nodes,key=lambda x:x["prod_dep_count"])
mo=max(nodes,key=lambda x:x["dependents_count"])
g={"generated_at":datetime.now().isoformat(),"total_projects":len(projects),"nodes":nodes,"edges":edges,"stats":{"total_internal_deps":len(edges),"total_external_deps":sum(len(n["external_deps"]) for n in nodes),"max_internal_deps":mi,"max_external_deps":me,"most_depended_on":mo["id"],"most_dependencies":md["id"]}}
json.dump(g,open(os.path.join(BASE,"DEPENDENCY_GRAPH.json"),"w"),indent=2)
print("Wrote DEPENDENCY_GRAPH.json nodes=%d edges=%d"%(len(nodes),len(edges)))
u={}
for node in nodes:
  for d in node["external_deps"]:
    u.setdefault(d["name"],[]).append(node["id"])
sh=sorted(((k,v) for k,v in u.items() if len(v)>1),key=lambda x:-len(x[1]))[:25]
sn=sorted(nodes,key=lambda x:-x["impact_score"])
L=[]
L.append("# Dependency Graph Report")
L.append("")
L.append("Generated: "+g["generated_at"])
L.append("")
L.append("## Summary")
L.append("")
L.append("| Metric | Value |")
L.append("|--------|-------|")
L.append("| Projects | "+str(g["total_projects"])+" |")
L.append("| Internal dep edges | "+str(g["stats"]["total_internal_deps"])+" |")
L.append("| External dep entries | "+str(g["stats"]["total_external_deps"])+" |")
L.append("| Most depended-on | "+mo["id"]+" ("+str(mo["dependents_count"])+" dependents) |")
L.append("| Most dependencies | "+md["id"]+" ("+str(md["prod_dep_count"])+" deps) |")
L.append("")
L.append("## Internal Dependency Edges")
L.append("")
if not edges:
  L.append("*No internal dependencies detected.*")
else:
  L.append("| Consumer | Provider | Version |")
  L.append("|----------|----------|---------|")
  for e in edges:
    L.append("| "+e["from"]+" | "+e["to"]+" | "+e["version"]+" |")
L.append("")
L.append("## Projects (sorted by impact score)")
L.append("")
for node in sn:
  L.append("### "+node["id"])
  L.append("")
  L.append("- Path: "+node["path"])
  L.append("- Language: "+str(node["language"]))
  L.append("- Framework: "+str(node["framework"] or "none"))
  L.append("- Criticality: "+node["criticality"])
  L.append("- Impact: "+str(node["impact_score"])+" Dependents: "+str(node["dependents_count"]))
  L.append("- Prod deps: "+str(node["prod_dep_count"])+" Dev deps: "+str(node["dev_dep_count"]))
  L.append("")
  if node["internal_deps"]:
    L.append("Internal deps: "+", ".join(d["name"] for d in node["internal_deps"]))
    L.append("")
  if node["external_deps"]:
    top=node["external_deps"][:8]
    s=", ".join(d["name"] for d in top)
    if len(node["external_deps"])>8: s+=" (+"+str(len(node["external_deps"])-8)+" more)"
    L.append("Top external: "+s)
    L.append("")
L.append("## Shared External Dependencies")
L.append("")
L.append("| Package | Count | Projects |")
L.append("|---------|-------|----------|")
for pkg,users in sh:
  L.append("| "+pkg+" | "+str(len(users))+" | "+", ".join(users)+" |")
L.append("")
open(os.path.join(BASE,"DEPENDENCY_GRAPH.md"),"w",encoding="utf-8").write("\n".join(L))
print("Wrote DEPENDENCY_GRAPH.md")
intPkgs=sorted(set(e["to"] for e in edges))
dm={}
for e in edges:
  dm.setdefault(e["from"],set()).add(e["to"])
mx=[]
mx.append("# Project Dependency Matrix")
mx.append("")
mx.append("Generated: "+g["generated_at"])
mx.append("")
if not intPkgs:
  mx.append("*No internal dependencies found between projects.*")
else:
  mx.append("| Project | Impact | "+(" | ".join(intPkgs))+" |")
  mx.append("|---------|--------|"+("|".join("---" for _ in intPkgs))+"|")
  for node in sn:
    deps=dm.get(node["id"],set())
    mx.append("| "+node["id"]+" | "+str(node["impact_score"])+" |"+"".join(" "+("X" if pk in deps else " ")+" |" for pk in intPkgs))
  mx.append("| Dependents | |"+"".join(" "+str(dependeeCount.get(pk,0))+" |" for pk in intPkgs))
mx.append("")
open(os.path.join(BASE,"PROJECT_DEPENDENCY_MATRIX.md"),"w",encoding="utf-8").write("\n".join(mx))
print("Wrote PROJECT_DEPENDENCY_MATRIX.md")
print()
print("=== Summary ===")
print("Nodes:",len(nodes))
print("Internal edges:",len(edges))
print("External dep entries:",g["stats"]["total_external_deps"])
print("Most depended-on:",mo["id"],"("+str(mo["dependents_count"])+" dependents)")
print("Most dependencies:",md["id"],"("+str(md["prod_dep_count"])+" deps)")
print("Shared external deps:",len(sh))
print("Isolated projects:",sum(1 for n in nodes if n["prod_dep_count"]==0))
