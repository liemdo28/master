import type { GatewayConfig, ProviderHealth } from '../types.js';
import { publicProvider } from '../config/config-loader.js';

export function dashboardHtml(config: GatewayConfig, health: ProviderHealth[]): string {
  const providers = config.providers.map(publicProvider);
  const payload = JSON.stringify({ providers, health, mode: config.mode, port: config.port, aliases: config.modelAliases })
    .replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Antigravity Universal AI Gateway</title>
  <style>
    :root{color-scheme:dark;--bg:#050911;--panel:rgba(14,22,40,.78);--line:rgba(99,200,255,.14);--text:#e8f4ff;--muted:#7a9ab5;--cyan:#22d3ee;--pink:#fb7185;--green:#34d399;--amber:#fbbf24;--purple:#a78bfa;--blue:#60a5fa}
    *{box-sizing:border-box;margin:0}
    body{min-height:100vh;background:radial-gradient(ellipse at 15% 0%,rgba(34,211,238,.12),transparent 40%),radial-gradient(ellipse at 85% 5%,rgba(167,139,250,.1),transparent 35%),linear-gradient(160deg,#050911,#09122a 55%,#04060e);font-family:Inter,ui-sans-serif,system-ui;color:var(--text);font-size:14px}

    /* header */
    header{display:flex;align-items:center;justify-content:space-between;padding:18px 24px;border-bottom:1px solid var(--line);backdrop-filter:blur(20px);position:sticky;top:0;background:rgba(5,9,17,.8);z-index:10;gap:16px;flex-wrap:wrap}
    .logo{display:flex;align-items:center;gap:10px}.logo-icon{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,var(--cyan),var(--purple));display:flex;align-items:center;justify-content:center;font-size:16px}
    .logo h1{font-size:17px;font-weight:700;letter-spacing:.3px}
    .logo sub{display:block;font-size:11px;color:var(--muted);font-weight:400}
    .header-chips{display:flex;gap:8px;flex-wrap:wrap}
    .chip{font-size:11px;border:1px solid var(--line);border-radius:6px;padding:5px 10px;color:var(--muted);font-family:ui-monospace,monospace;background:rgba(255,255,255,.03)}
    .chip.active{border-color:rgba(34,211,238,.35);color:var(--cyan);background:rgba(34,211,238,.06)}

    /* layout */
    main{padding:20px 24px;display:grid;gap:16px}

    /* cards */
    .card{border:1px solid var(--line);background:var(--panel);backdrop-filter:blur(14px);border-radius:14px;padding:16px}
    .card-title{font-size:13px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:8px}
    .card-title span{font-size:11px;font-weight:400;text-transform:none;letter-spacing:0}

    /* stats row */
    .stats{display:grid;grid-template-columns:repeat(7,1fr);gap:12px}
    .stat-card{border:1px solid var(--line);background:var(--panel);border-radius:12px;padding:14px 16px}
    .stat-val{font-size:26px;font-weight:700;line-height:1}
    .stat-label{font-size:11px;color:var(--muted);margin-top:5px}

    /* grid */
    .grid-2{display:grid;grid-template-columns:1.3fr .7fr;gap:16px}
    .grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}

    /* provider cards */
    .providers{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
    .pcard{border:1px solid var(--line);background:rgba(10,18,35,.6);border-radius:12px;padding:14px;position:relative;overflow:hidden;transition:border-color .2s}
    .pcard:hover{border-color:rgba(99,200,255,.28)}
    .pcard-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px}
    .pcard-name{font-weight:700;font-size:14px}
    .pcard-id{font-size:11px;color:var(--muted);font-family:ui-monospace,monospace;margin-top:2px}
    .badge{font-size:10px;padding:3px 7px;border-radius:5px;border:1px solid;font-weight:600;letter-spacing:.3px;white-space:nowrap}
    .badge-anthropic{color:var(--purple);border-color:rgba(167,139,250,.4);background:rgba(167,139,250,.08)}
    .badge-openai{color:var(--blue);border-color:rgba(96,165,250,.4);background:rgba(96,165,250,.08)}
    .badge-ollama{color:var(--green);border-color:rgba(52,211,153,.4);background:rgba(52,211,153,.08)}
    .badge-healthy{color:var(--green);border-color:rgba(52,211,153,.4);background:rgba(52,211,153,.07)}
    .badge-degraded{color:var(--amber);border-color:rgba(251,191,36,.4);background:rgba(251,191,36,.07)}
    .badge-disabled,.badge-unknown{color:var(--muted);border-color:var(--line);background:transparent}
    .pcard-model{font-size:11px;color:var(--muted);font-family:ui-monospace,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:6px}
    .pcard-url{font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:10px}
    .latency-bar{height:4px;border-radius:99px;background:#111827;overflow:hidden;margin-bottom:10px}
    .latency-fill{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--cyan),var(--green));transition:width .4s}
    .pcard-meta{display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:10px}
    .caps{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px}
    .cap{font-size:9px;padding:2px 5px;border-radius:3px;border:1px solid var(--line);color:var(--muted)}
    .cap.on{border-color:rgba(34,211,238,.3);color:var(--cyan);background:rgba(34,211,238,.05)}
    button{font:inherit;border:0;border-radius:8px;padding:7px 12px;cursor:pointer;font-size:12px;font-weight:600;transition:opacity .15s}
    .btn-enable{background:linear-gradient(135deg,var(--green),#059669);color:#00110a;width:100%}
    .btn-disable{background:linear-gradient(135deg,var(--pink),#dc2626);color:#1a0000;width:100%}
    button:hover{opacity:.85}

    /* console */
    .console-row{display:grid;gap:10px}
    input,select,textarea{font:inherit;width:100%;border:1px solid var(--line);border-radius:8px;background:rgba(2,6,23,.72);color:var(--text);padding:9px 12px;outline:none;font-size:13px}
    input:focus,textarea:focus{border-color:rgba(34,211,238,.4)}
    textarea{min-height:90px;resize:vertical;font-family:ui-monospace,monospace;font-size:12px}
    .btn-primary{background:linear-gradient(135deg,var(--cyan),#2563eb);color:#001015;font-weight:800;width:100%;padding:10px}
    .resp-box{font-family:ui-monospace,monospace;font-size:11px;color:#d9f8ff;white-space:pre-wrap;min-height:100px;padding:12px;border:1px solid var(--line);border-radius:8px;background:rgba(2,6,23,.5);max-height:320px;overflow-y:auto}

    /* logs table */
    table{width:100%;border-collapse:collapse;font-size:12px}
    td,th{border-bottom:1px solid var(--line);padding:8px 10px;text-align:left}
    th{color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
    tr:last-child td{border-bottom:none}
    .log-ok{color:var(--green)}
    .log-fail{color:var(--pink)}
    .log-tool{color:var(--amber)}
    .log-stream{color:var(--blue)}
    .mono{font-family:ui-monospace,monospace}
    .tag{font-size:10px;padding:2px 5px;border-radius:3px;border:1px solid;display:inline-block;margin:1px}
    .tag-tool{color:var(--amber);border-color:rgba(251,191,36,.35);background:rgba(251,191,36,.07)}
    .tag-stream{color:var(--blue);border-color:rgba(96,165,250,.35);background:rgba(96,165,250,.07)}
    .src-healthy{color:var(--green)}
    .src-cooldown{color:var(--amber)}
    .src-exhausted,.src-disabled{color:var(--pink)}

    /* aliases */
    .aliases{display:flex;flex-wrap:wrap;gap:8px}
    .alias-entry{font-size:11px;border:1px solid var(--line);border-radius:6px;padding:5px 9px;background:rgba(255,255,255,.03);font-family:ui-monospace,monospace}
    .alias-entry strong{color:var(--cyan)}

    @media(max-width:1100px){.stats{grid-template-columns:repeat(3,1fr)}.grid-2,.grid-3{grid-template-columns:1fr}}
    @media(max-width:700px){.stats{grid-template-columns:repeat(2,1fr)}}

    /* Key management */
    .key-mgmt{display:grid;gap:12px}
    .key-mgmt-section{border:1px solid var(--line);background:rgba(10,18,35,.4);border-radius:10px;padding:12px;margin-bottom:10px}
    .key-mgmt-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
    .key-mgmt-head select,.key-mgmt-head input{flex:1;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:rgba(2,6,23,.7);color:var(--text);font-size:12px}
    .key-list{max-height:300px;overflow-y:auto;border:1px solid var(--line);border-radius:6px;background:rgba(2,6,23,.3)}
    .key-item{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--line);gap:8px}
    .key-item:last-child{border-bottom:none}
    .key-info{flex:1;min-width:0}
    .key-label{font-size:12px;font-weight:500;color:var(--cyan);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .key-masked{font-size:11px;color:var(--muted);font-family:ui-monospace,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .key-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
    .btn-sm{padding:4px 8px;font-size:10px;border:1px solid var(--line);border-radius:4px;background:rgba(255,255,255,.05);color:var(--text);cursor:pointer;transition:all .15s}
    .btn-sm:hover{background:rgba(34,211,238,.15);border-color:rgba(34,211,238,.3);color:var(--cyan)}
    .btn-sm.danger{color:var(--pink);border-color:rgba(251,113,133,.3)}
    .btn-sm.danger:hover{background:rgba(251,113,133,.1);border-color:rgba(251,113,133,.4)}
    .btn-sm.toggle-off{color:var(--muted)}
    .badge-small{font-size:9px;padding:2px 4px;border-radius:3px;border:1px solid;display:inline-block}
    .badge-small.active{border-color:rgba(52,211,153,.3);color:var(--green);background:rgba(52,211,153,.05)}
    .badge-small.inactive{border-color:rgba(107,114,128,.3);color:var(--muted);background:transparent}
  </style>
</head>
<body>
<header>
  <div class="logo">
    <div class="logo-icon">⚡</div>
    <div><h1>Antigravity Universal AI Gateway</h1><sub>Protocol-aware routing · tool-use bridging · real SSE streaming</sub></div>
  </div>
  <div class="header-chips">
    <span class="chip active">OpenAI: http://localhost:${config.port}/v1</span>
    <span class="chip active">Anthropic: http://localhost:${config.port}/v1/messages</span>
    <span class="chip">${config.mode} mode</span>
  </div>
</header>
<main>
  <!-- Stats -->
  <section class="stats">
    <div class="stat-card"><div class="stat-val" id="activeCount">0</div><div class="stat-label">Active providers</div></div>
    <div class="stat-card"><div class="stat-val" id="healthyCount">0</div><div class="stat-label">Healthy</div></div>
    <div class="stat-card"><div class="stat-val" id="requestCount">0</div><div class="stat-label">Requests logged</div></div>
    <div class="stat-card"><div class="stat-val" id="toolCount">0</div><div class="stat-label">Tool requests</div></div>
    <div class="stat-card"><div class="stat-val" id="queueActive">0</div><div class="stat-label">Active requests</div></div>
    <div class="stat-card"><div class="stat-val" id="queueQueued">0</div><div class="stat-label">Queued requests</div></div>
    <div class="stat-card"><div class="stat-val">${Object.keys(config.modelAliases).length}</div><div class="stat-label">Model aliases</div></div>
  </section>

  <!-- Providers + Console -->
  <section class="grid-2">
    <div class="card">
      <div class="card-title">Provider Mesh <span>protocol · health · latency</span></div>
      <div class="providers" id="providers"></div>
    </div>
    <div class="card">
      <div class="card-title">Route Test Console</div>
      <div class="console-row">
        <input id="testModel" value="claude-opus-4-7" placeholder="Model ID"/>
        <textarea id="testPrompt">Reply exactly: OK</textarea>
        <label style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:6px"><input type="checkbox" id="testTools" style="width:auto"/> Include tool definition (tests tool calling)</label>
        <button class="btn-primary" onclick="runTest()">Run Route Test</button>
        <div class="resp-box" id="testResp">Ready — click "Run Route Test".</div>
      </div>
    </div>
  </section>

  <section class="card">
    <div class="card-title">Supply Sources <span>source · key · model · cooldown</span></div>
    <table>
      <thead><tr><th>Source</th><th>Provider</th><th>Model</th><th>Key</th><th>Status</th><th>Active</th><th>Queued</th><th>Limit</th><th>Cooldown</th><th>Reset ETA</th><th>Last Error</th><th>Attempts</th><th>Action</th></tr></thead>
      <tbody id="sources"></tbody>
    </table>
  </section>

  <!-- Request Logs -->
  <section class="card">
    <div class="card-title">Request Logs <button onclick="refresh()" style="background:rgba(34,211,238,.15);color:var(--cyan);padding:4px 10px;font-size:11px">Refresh</button></div>
    <table>
      <thead><tr><th>Time</th><th>Model</th><th>Intent</th><th>Flags</th><th>Provider</th><th>Attempts</th><th>ms</th></tr></thead>
      <tbody id="logs"></tbody>
    </table>
  </section>

  <!-- Model aliases -->
  <section class="card">
    <div class="card-title">Model Alias Registry</div>
    <div class="aliases" id="aliases"></div>
  </section>

  <!-- Key Management -->
  <section class="card">
    <div class="card-title">API Key Management <span>add · toggle · delete</span></div>
    <div class="key-mgmt">
      <div class="key-mgmt-section">
        <div class="key-mgmt-head">
          <select id="keyProviderSelect" style="max-width:200px">
            <option value="">Select Provider...</option>
          </select>
          <input type="text" id="newKeyInput" placeholder="Paste API key here" style="flex:1"/>
          <input type="text" id="newKeyLabel" placeholder="Label (optional)" style="max-width:150px"/>
          <button onclick="addNewKey()" class="btn-sm" style="background:rgba(52,211,153,.15);color:var(--green);border-color:rgba(52,211,153,.3)">+ Add Key</button>
        </div>
        <div id="keyList" class="key-list">
          <div style="padding:20px;text-align:center;color:var(--muted);font-size:11px">Select a provider to view keys</div>
        </div>
      </div>
    </div>
  </section>
</main>
<script>
  window.__BOOT__ = ${payload};
  const S = window.__BOOT__;

  // ── Bangkok timezone formatters (UTC+7 · Asia/Bangkok · Hanoi · HCM) ──
  var _bkkTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', hour12: false,
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  var _bkkDateTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', hour12: false,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  function fmtTime(ts)     { return ts ? _bkkTime.format(new Date(ts))     : '—'; }
  function fmtDateTime(ts) { return ts ? _bkkDateTime.format(new Date(ts)) : '—'; }

  function cls(status){ return 'badge badge-'+(status||'unknown'); }
  function protoBadge(kind){ return '<span class="badge badge-'+(kind==='anthropic'?'anthropic':kind==='ollama'?'ollama':'openai')+'">'+(kind==='anthropic'?'Anthropic':'openai-compatible'==='ollama'?'Ollama':kind==='ollama'?'Ollama':'OpenAI compat')+'</span>'; }

  function renderProviders(){
    const h=new Map((S.health||[]).map(x=>[x.providerId,x]));
    document.getElementById('activeCount').textContent=S.providers.filter(p=>p.enabled).length;
    document.getElementById('healthyCount').textContent=[...h.values()].filter(x=>x.status==='healthy').length;
    document.getElementById('providers').innerHTML=S.providers.map(p=>{
      const hp=h.get(p.id)||{status:p.enabled?'unknown':'disabled',latencyMs:null,availableModels:[]};
      const w=hp.latencyMs?Math.max(5,Math.min(100,100-hp.latencyMs/15)):8;
      const caps=p.capabilities||{};
      return '<div class="pcard">'+
        '<div class="pcard-top">'+
          '<div><div class="pcard-name">'+p.label+'</div><div class="pcard-id">'+p.id+'</div></div>'+
          '<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">'+
            '<span class="'+cls(hp.status)+'">'+hp.status+'</span>'+
            '<span class="badge badge-'+(p.kind==='anthropic'?'anthropic':p.kind==='ollama'?'ollama':'openai')+'">'+
              (p.kind==='anthropic'?'Anthropic API':p.kind==='ollama'?'Ollama':'OpenAI compat')+
            '</span>'+
          '</div>'+
        '</div>'+
        '<div class="pcard-model">'+p.defaultModel+'</div>'+
        '<div class="pcard-url">'+p.baseURL+'</div>'+
        '<div class="latency-bar"><i class="latency-fill" style="width:'+w+'%"></i></div>'+
        '<div class="pcard-meta"><span>keys: '+p.keys.length+'</span><span>'+(hp.latencyMs??'-')+' ms</span><span>p'+p.priority+'</span></div>'+
        '<div class="caps">'+
          ['tools','streaming','thinking','vision','embeddings'].map(c=>'<span class="cap'+(caps[c]||caps.tools&&c==='vision'?'':caps[c]===false?'':caps.chat?'':' ')+(caps[c]===true||caps[c]?' on':'')+'">'+(caps[c]?'✓ ':'✗ ')+c+'</span>').join('')+
        '</div>'+
        '<button class="'+(p.enabled?'btn-disable':'btn-enable')+'" onclick="toggleProvider(\\''+p.id+'\\','+(!p.enabled)+')">'+(p.enabled?'Disable':'Enable')+'</button>'+
      '</div>';
    }).join('');
  }

  function renderLogs(logs){
    document.getElementById('requestCount').textContent=logs.length;
    document.getElementById('toolCount').textContent=logs.filter(l=>l.tools).length;
    document.getElementById('logs').innerHTML=(logs||[]).slice(0,60).map(l=>{
      const t=fmtTime(l.ts);
      const flags=[l.streaming?'<span class="tag tag-stream">stream</span>':'',l.tools?'<span class="tag tag-tool">tools</span>':''].filter(Boolean).join('');
      const attemptsStr=l.attempts.map(a=>{
        const label=a.ok?'ok':((a.error||'fail').split(':')[0]||'fail');
        return '<span style="color:'+(a.ok?'var(--green)':'var(--pink)')+'">'+(a.sourceId||a.providerId)+':'+label+'</span>';
      }).join(' → ');
      return '<tr><td class="mono">'+t+'</td><td class="mono">'+l.requestModel+'</td><td>'+l.intent+'</td><td>'+flags+'</td><td>'+(l.provider||'<span style="color:var(--pink)">failed</span>')+'</td><td class="mono">'+attemptsStr+'</td><td class="mono">'+(l.durationMs??'-')+'</td></tr>';
    }).join('');
  }

  function renderSources(src){
    const rows=((src&&src.supplySources)||[]).map(s=>{
      const cd=s.cooldownRemainingMs?Math.ceil(s.cooldownRemainingMs/1000)+'s':'—';
      const reset=s.resetEtaMs?Math.ceil(s.resetEtaMs/1000)+'s':'—';
      const err=s.lastErrorType||s.lastError||'—';
      const action=s.status==='disabled'
        ? '<button onclick="sourceAction(\\''+s.id+'\\',\\'enable\\')" style="padding:4px 8px">Enable</button>'
        : '<button onclick="sourceAction(\\''+s.id+'\\',\\'disable\\')" style="padding:4px 8px">Disable</button> '+
          '<button onclick="sourceAction(\\''+s.id+'\\',\\'reset\\')" style="padding:4px 8px">Reset</button>';
      return '<tr>'+
        '<td class="mono">'+s.id+'</td>'+
        '<td>'+s.provider+'</td>'+
        '<td class="mono">'+s.model+'</td>'+
        '<td class="mono">'+(s.keyLabel||s.keyId)+' / '+(s.maskedKey||'')+'</td>'+
        '<td class="src-'+s.status+'">'+s.status+'</td>'+
        '<td class="mono">'+(s.activeRequests||0)+'</td>'+
        '<td class="mono">'+(s.queuedRequests||0)+'</td>'+
        '<td class="mono">'+(s.concurrencyLimit||1)+'</td>'+
        '<td class="mono">'+cd+'</td>'+
        '<td class="mono">'+reset+'</td>'+
        '<td class="mono">'+String(err).slice(0,80)+'</td>'+
        '<td class="mono">'+(s.attempts||0)+' / '+(s.failures||0)+'</td>'+
        '<td>'+action+'</td>'+
      '</tr>';
    });
    document.getElementById('sources').innerHTML=rows.length?rows.join(''):'<tr><td colspan="13" style="color:var(--muted)">No supply sources</td></tr>';
  }

  function renderAliases(){
    document.getElementById('aliases').innerHTML=Object.entries(S.aliases||{}).map(([k,v])=>
      '<div class="alias-entry"><strong>'+k+'</strong> → '+(v.slice(0,2).join(', '))+(v.length>2?' +'+( v.length-2)+' more':'')+'</div>'
    ).join('');
  }

  async function refresh(){
    try{
      const [status,logs,runtime]=await Promise.all([fetch('/api/status').then(r=>r.json()),fetch('/api/logs').then(r=>r.json()),fetch('/api/gateway/runtime').then(r=>r.json())]);
      S.providers=status.providers;S.health=status.health;
      S.sourceRotation=runtime.sourceRotation||status.sourceRotation;
      document.getElementById('queueActive').textContent=(runtime.queue&&runtime.queue.active_requests)||0;
      document.getElementById('queueQueued').textContent=(runtime.queue&&runtime.queue.queued_requests)||0;
      renderProviders();renderSources(S.sourceRotation);renderLogs(logs.logs||[]);
    }catch(e){console.warn('refresh failed',e)}
  }

  async function runTest(){
    const respEl=document.getElementById('testResp');
    respEl.textContent='Routing…';
    const model=document.getElementById('testModel').value;
    const content=document.getElementById('testPrompt').value;
    const withTools=document.getElementById('testTools').checked;
    const body={model,messages:[{role:'user',content}],max_tokens:256};
    if(withTools){
      body.tools=[{type:'function',function:{name:'get_weather',description:'Get current weather',parameters:{type:'object',properties:{location:{type:'string',description:'City name'}},required:['location']}}}];
      body.tool_choice='auto';
    }
    try{
      const r=await fetch('/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer proxy'},body:JSON.stringify(body)});
      const data=await r.json();
      respEl.textContent=JSON.stringify(data,null,2);
    }catch(e){respEl.textContent='Error: '+e.message}
    refresh();
  }

  async function toggleProvider(id,enabled){
    await fetch('/api/providers/'+id+'/toggle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled})});
    refresh();
  }

  async function sourceAction(id,action){
    await fetch('/api/runtime/sources/'+id+'/'+action,{method:'POST'});
    refresh();
  }

  renderProviders();renderSources(S.sourceRotation);renderAliases();refresh();setInterval(refresh,4000);

  // ── Key Management ──
  let currentProvider=null;
  let keyCache={};

  async function loadKeyProviders(){
    try{
      const r=await fetch('/api/keys/providers');
      const data=await r.json();
      const select=document.getElementById('keyProviderSelect');
      select.innerHTML='<option value="">Select Provider...</option>'+
        Object.keys(data.providers).map(id=>'<option value="'+id+'">'+id+' ('+data.providers[id].keys.length+' keys)</option>').join('');
      select.onchange=()=>loadProviderKeys(select.value);
    }catch(e){console.error('Failed to load providers:',e)}
  }

  async function loadProviderKeys(providerId){
    if(!providerId){
      document.getElementById('keyList').innerHTML='<div style="padding:20px;text-align:center;color:var(--muted);font-size:11px">Select a provider to view keys</div>';
      currentProvider=null;
      return;
    }
    currentProvider=providerId;
    try{
      const r=await fetch('/api/keys/providers/'+providerId);
      const data=await r.json();
      keyCache[providerId]=data.keys;
      renderKeyList(data.keys,providerId);
    }catch(e){console.error('Failed to load keys:',e)}
  }

  function renderKeyList(keys,providerId){
    const html=keys.length?keys.map((k,i)=>'<div class="key-item">'+
      '<div class="key-info">'+
        '<div class="key-label">'+(k.label||'Unnamed')+'</div>'+
        '<div class="key-masked">'+k.masked+'</div>'+
      '</div>'+
      '<div class="key-actions">'+
        '<span class="badge-small '+(k.active?'active':'inactive')+'">'+(k.active?'Active':'Inactive')+'</span>'+
        '<button class="btn-sm" onclick="toggleKey(\\''+providerId+'\\',\\''+k.id+'\\')">'+(k.active?'Disable':'Enable')+'</button>'+
        '<button class="btn-sm danger" onclick="deleteKey(\\''+providerId+'\\',\\''+k.id+'\\')">Delete</button>'+
      '</div>'+
    '</div>').join(''):
    '<div style="padding:20px;text-align:center;color:var(--muted);font-size:11px">No keys for this provider</div>';
    document.getElementById('keyList').innerHTML=html;
  }

  async function addNewKey(){
    if(!currentProvider){alert('Select a provider first');return}
    const keyVal=document.getElementById('newKeyInput').value.trim();
    const label=document.getElementById('newKeyLabel').value.trim();
    if(!keyVal){alert('Enter an API key');return}
    try{
      const r=await fetch('/api/keys/providers/'+currentProvider+'/add',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({key:keyVal,label:label||undefined})
      });
      if(!r.ok) throw new Error('Failed to add key');
      document.getElementById('newKeyInput').value='';
      document.getElementById('newKeyLabel').value='';
      await loadProviderKeys(currentProvider);
    }catch(e){alert('Error: '+e.message)}
  }

  async function toggleKey(providerId,keyId){
    const keys=keyCache[providerId]||[];
    const key=keys.find(k=>k.id===keyId);
    if(!key) return;
    try{
      const r=await fetch('/api/keys/providers/'+providerId+'/keys/'+keyId+'/toggle',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({active:!key.active})
      });
      if(!r.ok) throw new Error('Failed to toggle key');
      await loadProviderKeys(providerId);
    }catch(e){alert('Error: '+e.message)}
  }

  async function deleteKey(providerId,keyId){
    if(!confirm('Delete this key?')) return;
    try{
      const r=await fetch('/api/keys/providers/'+providerId+'/keys/'+keyId,{method:'DELETE'});
      if(!r.ok) throw new Error('Failed to delete key');
      await loadProviderKeys(providerId);
    }catch(e){alert('Error: '+e.message)}
  }

  loadKeyProviders();
</script>
</body>
</html>`;
}
