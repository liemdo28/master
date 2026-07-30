// kb/unified/SearchEngine.js — Multilingual search over the Unified Knowledge DB
import { normalizeText } from './UnifiedKnowledgeDatabase.js';
const DEFAULT_TOP_K = 10;
const FTS_CANDIDATES = 80;

function buildFtsQuery(query) {
  const raw = query.replace(/["()*]/g,' ').split(/\s+/).filter(t=>t.length>1);
  const norm = normalizeText(query).split(/\s+/).filter(t=>t.length>1);
  const all = new Set([...raw,...norm]);
  if(!all.size) return null;
  return [...all].map(t=>`"${t.replace(/"/g,'')}"*`).join(' OR ');
}

export function searchKnowledge(db, query, { topK=DEFAULT_TOP_K, kind=null, projectId=null, semantic=false, domain=null, topic=null }={}) {
  if(!query||!query.trim()) return [];
  const ftsExpr = buildFtsQuery(query);
  if(!ftsExpr) return [];

  let sql = `SELECT ki.id,ki.kind,ki.subtype,ki.title,ki.path,ki.source_root,ki.project_id,ki.language,ki.tags,ki.size_bytes,ki.mtime_ms,`+
    `snippet(knowledge_fts,1,'[',']',' … ',16) AS snippet, bm25(knowledge_fts) AS score, ki.content `+
    `FROM knowledge_fts JOIN knowledge_items ki ON ki.id = knowledge_fts.rowid `+
    `WHERE knowledge_fts MATCH ?`;
  const params = [ftsExpr];

  if(kind) {
    if(Array.isArray(kind)) { sql += ` AND ki.kind IN (${kind.map(()=>'?').join(',')})`; params.push(...kind); }
    else { sql += ` AND ki.kind = ?`; params.push(kind); }
  }
  if(projectId) { sql += ` AND ki.project_id = ?`; params.push(projectId); }
  sql += ` ORDER BY bm25(knowledge_fts) LIMIT ${FTS_CANDIDATES}`;

  let rows;
  try { rows = db.prepare(sql).all(...params); }
  catch {
    // fallback: LIKE search
    const like = `%${query.replace(/[%_]/g,' ')}%`;
    let likeSql = `SELECT ki.*, 0 AS score, ki.content AS snippet FROM knowledge_items ki WHERE (ki.title LIKE ? OR ki.content LIKE ? OR ki.normalized_text LIKE ?)`;
    const lp = [like,like,like];
    if(kind) { if(Array.isArray(kind)){ likeSql+=` AND ki.kind IN (${kind.map(()=>'?').join(',')})`; lp.push(...kind); } else { likeSql+=` AND ki.kind=?`; lp.push(kind); } }
    if(projectId) { likeSql+=` AND ki.project_id=?`; lp.push(projectId); }
    likeSql+=` LIMIT ${FTS_CANDIDATES}`;
    rows = db.prepare(likeSql).all(...lp);
  }

  if(!rows||!rows.length) return [];
  // Normalize scores 0-1
  const max = Math.max(...rows.map(r=>Math.abs(r.score||0)), 1);
  rows.forEach(r => { r.score = max>0 ? (1 - Math.abs(r.score)/max) : 0; });
  rows.sort((a,b)=>b.score-a.score);
  rows = rows.slice(0,topK);

  // Attach project name
  const pIds = [...new Set(rows.filter(r=>r.project_id).map(r=>r.project_id))];
  const pMap = {};
  if(pIds.length) {
    const projects = db.prepare(`SELECT id, name, root_path FROM projects WHERE id IN (${pIds.map(()=>'?').join(',')})`).all(...pIds);
    for(const p of projects) pMap[p.id] = p;
  }
  return rows.map((r,i)=>({
    rank: i+1,
    id: r.id, kind: r.kind, subtype: r.subtype,
    title: r.title, path: r.path, source_root: r.source_root,
    project_id: r.project_id,
    project: pMap[r.project_id]||null,
    language: r.language, tags: r.tags, size_bytes: r.size_bytes,
    snippet: r.snippet||(r.content||'').slice(0,200),
    score: Math.round(r.score*1000)/1000,
  }));
}

export function searchProjects(db, query) {
  const nq = normalizeText(query);
  return db.prepare(`SELECT * FROM projects WHERE normalized_name LIKE ? OR name LIKE ? ORDER BY file_count DESC LIMIT 20`).all(`%${nq}%`, `%${query}%`);
}

export function searchReports(db, query, topK=10) {
  return searchKnowledge(db, query, { topK, kind: 'report' });
}

export function searchDecisions(db, query, topK=10) {
  return searchKnowledge(db, query, { topK, kind: 'decision' });
}

export function searchWorkflows(db, query, topK=10) {
  return searchKnowledge(db, query, { topK, kind: 'workflow' });
}

export function searchSourceCode(db, query, topK=10, projectId=null) {
  return searchKnowledge(db, query, { topK, kind: 'source_code', projectId });
}

export function fuzzySearchProjects(db, partial) {
  const n = normalizeText(partial);
  return db.prepare(`SELECT * FROM projects WHERE normalized_name LIKE ? OR root_path LIKE ? LIMIT 20`).all(`%${n}%`, `%${partial}%`);
}

export function getSourceMapForProject(db, projectId, filterExt=null) {
  let sql = `SELECT * FROM source_map WHERE project_id=?`;
  const params = [projectId];
  if(filterExt) { sql += ` AND ext=?`; params.push(filterExt); }
  sql += ` ORDER BY rel_path LIMIT 2000`;
  return db.prepare(sql).all(...params);
}

export function searchConnectors(db, query, topK=5) {
  return searchKnowledge(db, query, { topK, kind: 'integration_system_data' });
}

export function searchWhatsApp(db, query, topK=5) {
  return searchKnowledge(db, query, { topK, kind: 'whatsapp_data' });
}
