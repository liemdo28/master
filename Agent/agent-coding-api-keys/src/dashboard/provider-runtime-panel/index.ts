/**
 * Antigravity Runtime Operations Center
 *
 * Self-contained HTML dashboard served at GET /runtime.
 * Data flows exclusively via SSE (GET /api/runtime/stream) — no polling.
 *
 * Architecture: observation only.
 * This panel reads from the runtime orchestration layer but never modifies it.
 */

/* -------------------------------------------------------------------------- */
/* HTML template — all client-side JS uses string concatenation, not template  */
/* literals, so there are no ${} escaping hazards in this file.                */
/* -------------------------------------------------------------------------- */

export function runtimePanelHtml(): string {
  return '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>Antigravity Runtime OPS</title>\n' +
    '<style>\n' + CSS + '\n</style>\n' +
    '</head>\n' +
    '<body>\n' + BODY + '\n' +
    '<script>\n' + JS + '\n</script>\n' +
    '</body>\n' +
    '</html>';
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* CSS                                                                        */
/* ══════════════════════════════════════════════════════════════════════════ */

const CSS = `
:root {
  --bg: #070c18;
  --surface: rgba(6,16,40,0.72);
  --surface-2: rgba(0,8,24,0.5);
  --border: rgba(40,130,255,0.10);
  --border-hi: rgba(40,130,255,0.28);
  --text: #b8cce8;
  --text-dim: #3c5572;
  --text-bright: #deeeff;
  --accent: #00b8ff;
  --green: #00f090;
  --yellow: #ffc800;
  --red: #ff3860;
  --orange: #ff8c00;
  --purple: #9060ff;
}
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:'Courier New',monospace;font-size:13px;overflow-x:hidden}
body{
  background-image:
    radial-gradient(ellipse at 15% 15%,rgba(0,60,140,0.28) 0%,transparent 55%),
    radial-gradient(ellipse at 85% 85%,rgba(70,0,130,0.20) 0%,transparent 55%);
}
/* scan line */
body::after{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.025) 2px,rgba(0,0,0,0.025) 4px);pointer-events:none;z-index:9999}

/* ── Header ─────────────────────────────────────────────────────────────── */
.hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid var(--border);background:rgba(0,6,20,0.85);backdrop-filter:blur(10px);position:sticky;top:0;z-index:100}
.hdr-left h1{font-size:13px;letter-spacing:5px;color:var(--accent);font-weight:400;text-transform:uppercase}
.hdr-left .sub{font-size:10px;color:var(--text-dim);letter-spacing:2px;margin-top:2px}
.hdr-right{display:flex;align-items:center;gap:20px}
.ts{font-size:10px;color:var(--text-dim);letter-spacing:1px}
.live{display:flex;align-items:center;gap:7px;font-size:10px;letter-spacing:2px}
.ldot{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 8px rgba(0,240,144,0.6);animation:pg 2s infinite}
.ldot.off{background:var(--red);box-shadow:0 0 8px rgba(255,56,96,0.6);animation:pr 1s infinite}
@keyframes pg{0%,100%{opacity:1;box-shadow:0 0 6px rgba(0,240,144,0.5)}50%{opacity:.6;box-shadow:0 0 18px rgba(0,240,144,0.9)}}
@keyframes pr{0%,100%{opacity:1}50%{opacity:.3}}

/* ── Grid ────────────────────────────────────────────────────────────────── */
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px 16px;max-width:1440px;margin:0 auto}
.full{grid-column:1/-1}
.three-col{grid-template-columns:1fr 1fr 1fr}

/* ── Panel ────────────────────────────────────────────────────────────────── */
.pnl{background:var(--surface);border:1px solid var(--border);border-radius:6px;backdrop-filter:blur(6px);overflow:hidden}
.ph{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;border-bottom:1px solid var(--border);background:rgba(0,4,16,0.5)}
.pt{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--accent);font-weight:400}
.pb{font-size:9px;color:var(--text-dim);letter-spacing:1px}
.pbody{padding:14px}
.pbody-0{padding:0}

/* ── Status badges ────────────────────────────────────────────────────────── */
.badge{font-size:9px;padding:2px 7px;border-radius:3px;letter-spacing:2px;text-transform:uppercase;display:inline-block}
.b-active{background:rgba(0,240,144,.10);color:var(--green);border:1px solid rgba(0,240,144,.30)}
.b-standby{background:rgba(0,184,255,.07);color:var(--accent);border:1px solid rgba(0,184,255,.20)}
.b-exhausted{background:rgba(255,56,96,.10);color:var(--red);border:1px solid rgba(255,56,96,.30)}
.b-degraded{background:rgba(255,140,0,.10);color:var(--orange);border:1px solid rgba(255,140,0,.30)}
.b-breaker_open{background:rgba(255,56,96,.14);color:var(--red);border:1px solid rgba(255,56,96,.40);box-shadow:0 0 8px rgba(255,56,96,.20)}
.b-unknown{background:rgba(80,80,80,.10);color:var(--text-dim);border:1px solid rgba(80,80,80,.20)}

/* ── Active Rotation ──────────────────────────────────────────────────────── */
.rot-wrap{display:flex;flex-direction:column;gap:14px}
.rot-top{display:flex;align-items:center;gap:10px}
.glow-dot{width:11px;height:11px;border-radius:50%;background:var(--green);box-shadow:0 0 12px rgba(0,240,144,.7);animation:pg 2s infinite;flex-shrink:0}
.glow-dot.sd{background:var(--accent);box-shadow:0 0 8px rgba(0,184,255,.4);animation:none}
.pname{font-size:20px;letter-spacing:4px;color:var(--text-bright);text-transform:uppercase}
.batch-row{display:flex;flex-direction:column;gap:6px}
.batch-hd{display:flex;justify-content:space-between;font-size:10px;color:var(--text-dim);letter-spacing:1px}
.batch-ct{font-size:12px;color:var(--text-bright)}
.track{height:7px;border-radius:4px;background:rgba(255,255,255,.05);border:1px solid var(--border);overflow:hidden}
.fill{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--green),var(--accent));box-shadow:0 0 8px rgba(0,240,144,.35);transition:width .8s ease}
.fill.sd-fill{background:linear-gradient(90deg,var(--accent),var(--purple));box-shadow:0 0 8px rgba(0,184,255,.35)}
.nxt{display:flex;align-items:center;gap:8px;font-size:10px;color:var(--text-dim);padding:7px 10px;border:1px dashed var(--border);border-radius:4px}
.nxt-arr{color:var(--accent);font-size:14px}
.nxt-p{color:var(--text);letter-spacing:1px}
.rot-flow{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.rpill{font-size:9px;padding:3px 9px;border-radius:10px;letter-spacing:1px;text-transform:uppercase}
.rpill-cur{background:rgba(0,240,144,.13);border:1px solid rgba(0,240,144,.35);color:var(--green)}
.rpill-nxt{background:rgba(40,130,255,.06);border:1px solid var(--border);color:var(--text-dim)}
.rarr{color:var(--text-dim);font-size:11px}

/* ── Quota Table ──────────────────────────────────────────────────────────── */
.qt{width:100%;border-collapse:collapse;font-size:11px}
.qt th{text-align:left;padding:6px 10px;color:var(--text-dim);font-size:9px;letter-spacing:2px;text-transform:uppercase;border-bottom:1px solid var(--border);font-weight:400}
.qt td{padding:10px 10px;border-bottom:1px solid rgba(40,130,255,.05);vertical-align:middle}
.qt tr:last-child td{border-bottom:none}
.qt tbody tr:hover td{background:rgba(40,130,255,.03)}
.pcell{display:flex;align-items:center;gap:7px}
.pdot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.pd-active{background:var(--green);box-shadow:0 0 5px rgba(0,240,144,.7)}
.pd-standby{background:var(--accent)}
.pd-exhausted{background:var(--red)}
.pd-degraded{background:var(--orange)}
.pd-breaker_open{background:var(--red);animation:pr 1s infinite}
.pd-unknown{background:var(--text-dim)}
.pn{letter-spacing:1px;text-transform:uppercase;font-size:11px}
.qbar{width:64px;height:4px;background:rgba(255,255,255,.05);border-radius:2px;overflow:hidden;display:inline-block;vertical-align:middle;margin-right:5px}
.qfill{height:100%;border-radius:2px;transition:width .8s ease}
.qf-ok{background:var(--green)}
.qf-low{background:var(--yellow)}
.qf-ex{background:var(--red)}
.rtimer{font-variant-numeric:tabular-nums;letter-spacing:1px;font-size:11px}
.rt-ok{color:var(--text)}
.rt-low{color:var(--yellow)}
.rt-crit{color:var(--red)}
.rt-ns{color:var(--text-dim);font-size:9px;letter-spacing:.5px}

/* ── Window Timers ─────────────────────────────────────────────────────────── */
.tgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.tcard{display:flex;flex-direction:column;gap:4px;padding:12px;border:1px solid var(--border);border-radius:5px;background:var(--surface-2)}
.tn{font-size:9px;letter-spacing:2px;color:var(--text-dim);text-transform:uppercase;margin-bottom:2px}
.td{font-size:22px;letter-spacing:2px;font-variant-numeric:tabular-nums;color:var(--text-bright)}
.td.ns{font-size:10px;color:var(--text-dim);letter-spacing:.5px}
.td.low{color:var(--yellow)}
.td.crit{color:var(--red);animation:pr 1s infinite}
.tl{font-size:9px;color:var(--text-dim);letter-spacing:1px}

/* ── Breakers ──────────────────────────────────────────────────────────────── */
.bklist{display:flex;flex-direction:column;gap:8px}
.bkitem{display:flex;align-items:center;justify-content:space-between;padding:8px 11px;border:1px solid var(--border);border-radius:4px}
.bkname{font-size:10px;letter-spacing:2px;text-transform:uppercase}
.bkright{display:flex;align-items:center;gap:10px}
.bkstate{font-size:9px;padding:2px 7px;border-radius:3px;letter-spacing:2px;text-transform:uppercase}
.bk-closed{background:rgba(0,240,144,.09);color:var(--green);border:1px solid rgba(0,240,144,.22)}
.bk-open{background:rgba(255,56,96,.14);color:var(--red);border:1px solid rgba(255,56,96,.38);box-shadow:0 0 8px rgba(255,56,96,.18)}
.bk-half_open{background:rgba(255,200,0,.09);color:var(--yellow);border:1px solid rgba(255,200,0,.28)}
.bktrips{font-size:9px;color:var(--text-dim)}

/* ── Performance Table ────────────────────────────────────────────────────── */
.pt2{width:100%;border-collapse:collapse;font-size:11px}
.pt2 th{text-align:left;padding:6px 12px;color:var(--text-dim);font-size:9px;letter-spacing:2px;text-transform:uppercase;border-bottom:1px solid var(--border);font-weight:400}
.pt2 td{padding:8px 12px;border-bottom:1px solid rgba(40,130,255,.05)}
.pt2 tr:last-child td{border-bottom:none}
.pt2 tbody tr:hover td{background:rgba(40,130,255,.03)}
.ml{color:var(--text-dim);font-size:10px;letter-spacing:1px}
.ok{color:var(--green)}
.wn{color:var(--yellow)}
.bd{color:var(--red)}

/* ── Timeline ──────────────────────────────────────────────────────────────── */
.tlist{display:flex;flex-direction:column;max-height:230px;overflow-y:auto}
.tlist::-webkit-scrollbar{width:3px}
.tlist::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
.tentry{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid rgba(40,130,255,.05);align-items:flex-start}
.tentry:last-child{border-bottom:none}
.ttime{font-size:9px;color:var(--text-dim);white-space:nowrap;min-width:42px;padding-top:2px;letter-spacing:.5px}
.tdotcol{display:flex;flex-direction:column;align-items:center;min-width:14px}
.tdot{width:6px;height:6px;border-radius:50%;margin-top:4px;flex-shrink:0}
.td-switch{background:var(--accent)}
.td-started{background:var(--green)}
.td-reset{background:var(--purple)}
.td-exhausted{background:var(--red)}
.td-degraded{background:var(--orange)}
.td-fallback{background:var(--yellow)}
.td-def{background:var(--text-dim)}
.tcont{flex:1;font-size:10px;line-height:1.4}
.ttype{color:var(--text-dim);font-size:8px;letter-spacing:2px;text-transform:uppercase;margin-bottom:1px}
.tdesc{color:var(--text)}

/* ── Distribution ─────────────────────────────────────────────────────────── */
.dlist{display:flex;flex-direction:column;gap:12px}
.ditem{display:flex;flex-direction:column;gap:5px}
.dhd{display:flex;justify-content:space-between;font-size:10px}
.dp{letter-spacing:2px;text-transform:uppercase}
.dc{color:var(--text-dim)}
.dtrack{height:6px;background:rgba(255,255,255,.05);border-radius:3px;overflow:hidden}
.dfill{height:100%;border-radius:3px;transition:width 1s ease}
.df-nkq{background:linear-gradient(90deg,var(--green),rgba(0,240,144,.4))}
.df-opus{background:linear-gradient(90deg,var(--accent),rgba(0,184,255,.4))}
.df-other{background:linear-gradient(90deg,var(--purple),rgba(144,96,255,.4))}
.dpct{font-size:9px;color:var(--text-dim);text-align:right}

/* ── Health ────────────────────────────────────────────────────────────────── */
.hgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:12px;padding-top:10px;border-top:1px solid var(--border)}
.hitem{display:flex;flex-direction:column;gap:3px;padding:8px;border:1px solid var(--border);border-radius:4px}
.hl{font-size:8px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase}
.hv{font-size:12px;color:var(--text-bright)}
.hv.ok{color:var(--green)}
.hv.wn{color:var(--yellow)}
.hv.bd{color:var(--red)}

/* ── Alerts ────────────────────────────────────────────────────────────────── */
.alist{display:flex;flex-direction:column;gap:5px;max-height:100px;overflow-y:auto}
.aitem{display:flex;align-items:center;gap:9px;padding:6px 10px;border-radius:4px;font-size:10px;animation:fi .3s ease}
@keyframes fi{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:translateY(0)}}
.a-info{background:rgba(0,184,255,.07);border:1px solid rgba(0,184,255,.18)}
.a-warn{background:rgba(255,200,0,.07);border:1px solid rgba(255,200,0,.22)}
.a-error{background:rgba(255,56,96,.09);border:1px solid rgba(255,56,96,.28)}
.aicon{font-size:13px}
.atxt{flex:1;color:var(--text)}
.ats{color:var(--text-dim);font-size:8px;white-space:nowrap}
.nodata{color:var(--text-dim);font-size:10px;padding:8px 0;letter-spacing:1px}

/* ── 15-min Rotation Clock Widget ─────────────────────────────────────────── */
.rw-wrap{display:flex;flex-direction:column;gap:14px}
.rw-clock{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border-hi);border-radius:6px;background:var(--surface-2)}
.rw-dial{position:relative;width:56px;height:56px;flex-shrink:0}
.rw-dial svg{transform:rotate(-90deg)}
.rw-dial-label{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--accent);letter-spacing:1px;font-variant-numeric:tabular-nums}
.rw-info{display:flex;flex-direction:column;gap:5px;flex:1}
.rw-win-label{font-size:10px;color:var(--text-dim);letter-spacing:1px}
.rw-primary{font-size:18px;letter-spacing:3px;text-transform:uppercase;color:var(--green);font-weight:400}
.rw-fallback{font-size:10px;color:var(--text-dim);letter-spacing:1px}
.rw-remaining{font-size:12px;letter-spacing:2px;font-variant-numeric:tabular-nums;color:var(--text)}
.rw-remaining.low{color:var(--yellow)}
.rw-remaining.crit{color:var(--red);animation:pr 1s infinite}
.rw-flow{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.rw-slot{font-size:9px;padding:3px 10px;border-radius:10px;letter-spacing:1px;text-transform:uppercase}
.rw-slot-active{background:rgba(0,240,144,.14);border:1px solid rgba(0,240,144,.4);color:var(--green)}
.rw-slot-next{background:rgba(0,184,255,.06);border:1px solid var(--border);color:var(--text-dim)}
.rw-arr{color:var(--text-dim);font-size:11px}

/* ── Operator controls ─────────────────────────────────────────────────────── */
.ops-group{display:flex;align-items:center;gap:8px}
.btn{font-family:'Courier New',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;
     padding:5px 12px;border-radius:3px;border:1px solid;cursor:pointer;transition:all .15s ease}
.btn:active{transform:scale(.97)}
.btn-reset{background:rgba(255,56,96,.08);border-color:rgba(255,56,96,.35);color:var(--red)}
.btn-reset:hover{background:rgba(255,56,96,.18);border-color:rgba(255,56,96,.6)}
.btn-sm{font-size:8px;padding:3px 8px;letter-spacing:1px}
.btn-provider{background:rgba(0,184,255,.06);border-color:rgba(0,184,255,.25);color:var(--accent)}
.btn-provider:hover{background:rgba(0,184,255,.14);border-color:rgba(0,184,255,.5)}
.rst-flash{animation:rst .6s ease forwards}
@keyframes rst{0%{opacity:1}50%{opacity:.3}100%{opacity:1}}

/* ── Provider Control Center ───────────────────────────────────────────────── */
.cc-body{display:flex;gap:0}
.cc-left{flex:0 0 272px;display:flex;flex-direction:column;gap:15px;padding:16px 18px;border-right:1px solid var(--border)}
.cc-right{flex:1;overflow-x:auto}
.cc-active-wrap{display:flex;flex-direction:column;gap:5px}
.cc-active-label{font-size:8px;letter-spacing:3px;color:var(--text-dim);text-transform:uppercase;margin-bottom:2px}
.cc-active-name{font-size:22px;letter-spacing:4px;text-transform:uppercase;line-height:1.15;font-weight:400}
.cc-active-name.cc-manual{color:var(--green);text-shadow:0 0 20px rgba(0,240,144,.25)}
.cc-active-name.cc-automode{color:var(--accent);font-size:15px;letter-spacing:2px}
.cc-active-since{font-size:9px;color:var(--text-dim);letter-spacing:.5px;margin-top:2px}
.cc-stats{display:flex;flex-direction:column;gap:0;border:1px solid var(--border);border-radius:4px;overflow:hidden;background:var(--surface-2)}
.cc-stat-row{display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-bottom:1px solid rgba(40,130,255,.05)}
.cc-stat-row:last-child{border-bottom:none}
.cc-sl{font-size:9px;color:var(--text-dim);letter-spacing:.8px}
.cc-sv{font-size:11px;color:var(--text-bright);font-variant-numeric:tabular-nums}
.cc-qbtns{display:flex;flex-direction:column;gap:5px;margin-top:2px}
.cc-qbtn{background:rgba(0,184,255,.07);border-color:rgba(0,184,255,.26);color:var(--accent);text-align:left;padding:5px 10px}
.cc-qbtn:hover{background:rgba(0,184,255,.17);border-color:rgba(0,184,255,.52)}
.cc-qbtn-auto{background:rgba(144,96,255,.06);border-color:rgba(144,96,255,.25);color:var(--purple);text-align:left;padding:5px 10px}
.cc-qbtn-auto:hover{background:rgba(144,96,255,.16);border-color:rgba(144,96,255,.45)}
.cc-qbtn-em{background:rgba(255,56,96,.08);border-color:rgba(255,56,96,.32);color:var(--red);text-align:left;padding:5px 10px}
.cc-qbtn-em:hover{background:rgba(255,56,96,.18);border-color:rgba(255,56,96,.54)}
/* control table */
.cct{width:100%;border-collapse:collapse;font-size:11px}
.cct th{text-align:left;padding:8px 16px;color:var(--text-dim);font-size:9px;letter-spacing:2px;text-transform:uppercase;border-bottom:1px solid var(--border);font-weight:400}
.cct td{padding:12px 16px;border-bottom:1px solid rgba(40,130,255,.05);vertical-align:middle}
.cct tr:last-child td{border-bottom:none}
.cct tbody tr:hover td{background:rgba(40,130,255,.04)}
.cct-act-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 10px rgba(0,240,144,.85);animation:pg 2s infinite;vertical-align:middle}
.btn-activate{font-family:'Courier New',monospace;font-size:9px;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;border-radius:3px;border:1px solid;cursor:pointer;transition:all .15s ease;background:rgba(0,184,255,.06);border-color:rgba(0,184,255,.24);color:var(--accent)}
.btn-activate:hover{background:rgba(0,184,255,.16);border-color:rgba(0,184,255,.48)}
.btn-activate:active{transform:scale(.97)}

/* ── Key Status Table ──────────────────────────────────────────────────────── */
.kt{width:100%;border-collapse:collapse;font-size:11px}
.kt th{text-align:left;padding:5px 10px;color:var(--text-dim);font-size:9px;letter-spacing:2px;text-transform:uppercase;border-bottom:1px solid var(--border);font-weight:400}
.kt td{padding:8px 10px;border-bottom:1px solid rgba(40,130,255,.05);vertical-align:middle}
.kt tr:last-child td{border-bottom:none}
.kt tbody tr:hover td{background:rgba(40,130,255,.03)}
.ks-healthy{color:var(--green)}
.ks-rate_limited{color:var(--yellow)}
.ks-quota_exhausted{color:var(--red)}
.ks-auth_failed{color:var(--red);font-weight:bold}
.ks-timeout{color:var(--orange)}
.ks-cooldown{color:var(--orange)}
.ks-disabled{color:var(--text-dim)}
.key-id{font-size:9px;letter-spacing:1px;color:var(--text-dim);font-family:'Courier New',monospace}
.key-masked{font-size:9px;color:var(--text-dim);font-family:'Courier New',monospace}
.cd-pill{font-size:8px;padding:1px 6px;border-radius:10px;background:rgba(255,140,0,.12);border:1px solid rgba(255,140,0,.3);color:var(--orange);font-variant-numeric:tabular-nums}
.btn-key{font-family:'Courier New',monospace;font-size:8px;letter-spacing:1px;text-transform:uppercase;
  padding:2px 7px;border-radius:3px;border:1px solid;cursor:pointer;transition:all .1s ease;margin:0 2px}
.btn-key-dis{background:rgba(255,56,96,.07);border-color:rgba(255,56,96,.28);color:var(--red)}
.btn-key-dis:hover{background:rgba(255,56,96,.18)}
.btn-key-en{background:rgba(0,240,144,.07);border-color:rgba(0,240,144,.28);color:var(--green)}
.btn-key-en:hover{background:rgba(0,240,144,.18)}
.btn-key-rst{background:rgba(0,184,255,.07);border-color:rgba(0,184,255,.28);color:var(--accent)}
.btn-key-rst:hover{background:rgba(0,184,255,.18)}

/* ── Provider Dashboard Links ──────────────────────────────────────────────── */
.dash-links{display:flex;align-items:center;gap:6px}
.dash-link{display:flex;align-items:center;gap:5px;font-family:'Courier New',monospace;font-size:9px;
  letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;
  padding:4px 10px;border-radius:3px;border:1px solid;transition:all .15s ease}
.dash-link-nkq{background:rgba(0,240,144,.06);border-color:rgba(0,240,144,.25);color:var(--green)}
.dash-link-nkq:hover{background:rgba(0,240,144,.16);border-color:rgba(0,240,144,.55);box-shadow:0 0 8px rgba(0,240,144,.2)}
.dash-link-opus{background:rgba(0,184,255,.06);border-color:rgba(0,184,255,.25);color:var(--accent)}
.dash-link-opus:hover{background:rgba(0,184,255,.16);border-color:rgba(0,184,255,.55);box-shadow:0 0 8px rgba(0,184,255,.2)}
.dash-link svg{width:10px;height:10px;flex-shrink:0;opacity:.7}
`;

/* ══════════════════════════════════════════════════════════════════════════ */
/* HTML body                                                                  */
/* ══════════════════════════════════════════════════════════════════════════ */

const BODY = `
<div class="hdr">
  <div class="hdr-left">
    <h1>Antigravity&nbsp;&nbsp;Runtime&nbsp;&nbsp;OPS</h1>
    <div class="sub" id="hdr-status">RUNTIME · ORCHESTRATION · STATUS &nbsp;|&nbsp; connecting…</div>
  </div>
  <div class="hdr-right">
    <div class="dash-links">
      <a class="dash-link" href="/admin/keys" style="background:rgba(144,96,255,.07);border-color:rgba(144,96,255,.3);color:#9060ff" title="Manage API Keys">🔑 Keys</a>
      <a class="dash-link dash-link-nkq" href="https://api.nkq.vn/dashboard/AGOP-6094-13E6-51AB" target="_blank" rel="noopener" title="Open NKQ Dashboard">
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 2h3v3H2zm5 0h3v3H7zm0 5h3v3H7zM2 7h3v3H2z"/></svg>
        NKQ
      </a>
      <a class="dash-link dash-link-opus" href="https://opusmax.shop/dashboard" target="_blank" rel="noopener" title="Open OpusMax Dashboard">
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 2h3v3H2zm5 0h3v3H7zm0 5h3v3H7zM2 7h3v3H2z"/></svg>
        OPUSMAX
      </a>
    </div>
    <div class="ops-group">
      <button class="btn btn-reset" onclick="doResetAll()" title="Reset all orchestrator state to zero">⟳ Reset State</button>
    </div>
    <div class="ts" id="last-ts">—</div>
    <div class="live">
      <div class="ldot" id="ldot"></div>
      <span id="llabel" style="color:var(--green)">LIVE</span>
    </div>
  </div>
</div>

<div class="grid">

  <!-- Provider Control Center (full width, always first) -->
  <div class="pnl full" id="cc-panel">
    <div class="ph">
      <div style="display:flex;align-items:center;gap:12px">
        <span class="pt">Runtime Provider Control</span>
        <span id="cc-mode-badge" class="badge b-standby">ASSISTED AUTO</span>
      </div>
      <span class="pb" id="cc-mode-hint">Orchestrator-managed rotation active</span>
    </div>
    <div class="cc-body">

      <!-- Left: active indicator + stats + quick buttons -->
      <div class="cc-left">
        <div class="cc-active-wrap">
          <div class="cc-active-label">Current Active Provider</div>
          <div class="cc-active-name cc-automode" id="cc-provider-name">AUTO</div>
          <div class="cc-active-since" id="cc-active-since">Orchestrator-managed</div>
        </div>
        <div class="cc-stats">
          <div class="cc-stat-row"><span class="cc-sl">Requests Routed</span><span class="cc-sv" id="cc-st-req">—</span></div>
          <div class="cc-stat-row"><span class="cc-sl">Avg Latency</span><span class="cc-sv" id="cc-st-lat">—</span></div>
          <div class="cc-stat-row"><span class="cc-sl">Quota Remaining</span><span class="cc-sv" id="cc-st-quota">—</span></div>
          <div class="cc-stat-row"><span class="cc-sl">Breaker State</span><span class="cc-sv" id="cc-st-bk">—</span></div>
        </div>
        <div class="cc-qbtns">
          <button class="btn cc-qbtn" onclick="doSwitchProvider('antigravity')">⚡ Switch to NKQ</button>
          <button class="btn cc-qbtn" onclick="doSwitchProvider('opusmax')">⚡ Switch to OpusMax</button>
          <button class="btn cc-qbtn-auto" onclick="doSetMode('assisted-auto')">↺ Auto Mode</button>
          <button class="btn cc-qbtn-em" onclick="doEmergencyLocal()">🔴 Emergency Local</button>
          <div style="height:1px;background:var(--border);margin:4px 0"></div>
          <a class="btn dash-link dash-link-nkq" href="https://api.nkq.vn/dashboard/AGOP-6094-13E6-51AB" target="_blank" rel="noopener">↗ NKQ Dashboard</a>
          <a class="btn dash-link dash-link-opus" href="https://opusmax.shop/dashboard" target="_blank" rel="noopener">↗ OpusMax Dashboard</a>
        </div>
      </div>

      <!-- Right: provider table -->
      <div class="cc-right">
        <table class="cct">
          <thead><tr>
            <th>Provider</th><th>Status</th><th>Active</th><th>Action</th>
          </tr></thead>
          <tbody id="cct-body"><tr><td colspan="4" class="nodata" style="padding:16px">Connecting…</td></tr></tbody>
        </table>
      </div>

    </div>
  </div>

  <!-- 15-min Rotation Window Clock -->
  <div class="pnl">
    <div class="ph">
      <span class="pt">15-Min Rotation Window</span>
      <span class="pb" id="rw-remaining-hdr">—</span>
    </div>
    <div class="pbody"><div id="rw-body" class="nodata">Connecting…</div></div>
  </div>

  <!-- Active Rotation -->
  <div class="pnl">
    <div class="ph"><span class="pt">Active Rotation</span><span class="pb" id="until-switch">—</span></div>
    <div class="pbody"><div id="rot-body" class="nodata">Connecting…</div></div>
  </div>

  <!-- Provider Quota Table -->
  <div class="pnl">
    <div class="ph"><span class="pt">Provider Quota</span><span class="pb" id="quota-ts">—</span></div>
    <div class="pbody-0">
      <table class="qt">
        <thead><tr>
          <th>Provider</th><th>Used</th><th>Remaining</th><th>Total</th>
          <th>Reset In</th><th>Batch</th><th>Failures</th><th>Status</th>
        </tr></thead>
        <tbody id="quota-body"><tr><td colspan="8" class="nodata" style="padding:14px">Connecting…</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- Window Timers -->
  <div class="pnl">
    <div class="ph"><span class="pt">Reset Window Timers</span><span class="pb">5 h rolling</span></div>
    <div class="pbody"><div class="tgrid" id="timer-grid"><div class="nodata">Connecting…</div></div></div>
  </div>

  <!-- Circuit Breakers -->
  <div class="pnl">
    <div class="ph"><span class="pt">Circuit Breakers</span><span class="pb" id="bk-sum">—</span></div>
    <div class="pbody"><div class="bklist" id="bk-list"><div class="nodata">Connecting…</div></div></div>
  </div>

  <!-- API Key Status Table (full width) -->
  <div class="pnl full">
    <div class="ph">
      <span class="pt">API Key Status</span>
      <span class="pb" id="key-status-sum">—</span>
    </div>
    <div class="pbody-0">
      <table class="kt">
        <thead><tr>
          <th>Provider</th><th>Key ID</th><th>Status</th><th>Requests</th>
          <th>Failures</th><th>Last Success</th><th>Last Error</th><th>Cooldown</th><th>Actions</th>
        </tr></thead>
        <tbody id="key-table-body"><tr><td colspan="9" class="nodata" style="padding:14px">Connecting…</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- Performance (full width) -->
  <div class="pnl full">
    <div class="ph"><span class="pt">Provider Performance Metrics</span><span class="pb">realtime</span></div>
    <div class="pbody-0">
      <table class="pt2">
        <thead><tr>
          <th>Metric</th><th>NKQ — Antigravity</th><th>OpusMax</th><th>Gateway Total</th>
        </tr></thead>
        <tbody id="perf-body"><tr><td colspan="4" class="nodata" style="padding:14px">Connecting…</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- Rotation Timeline -->
  <div class="pnl">
    <div class="ph"><span class="pt">Rotation Timeline</span><span class="pb">last 20 events</span></div>
    <div class="pbody" style="padding:6px 14px">
      <div class="tlist" id="tl-list"><div class="nodata">Connecting…</div></div>
    </div>
  </div>

  <!-- Distribution + Health -->
  <div class="pnl">
    <div class="ph"><span class="pt">Request Distribution</span><span class="pb" id="dist-total">0 req</span></div>
    <div class="pbody">
      <div class="dlist" id="dist-list"><div class="nodata">Connecting…</div></div>
      <div class="hgrid" id="h-grid"></div>
    </div>
  </div>

  <!-- Alerts (full width) -->
  <div class="pnl full">
    <div class="ph"><span class="pt">Runtime Alerts</span><span class="pb" id="alert-ct">no alerts</span></div>
    <div class="pbody"><div class="alist" id="a-list"><div class="nodata">No active alerts</div></div></div>
  </div>

</div>
`;

/* ══════════════════════════════════════════════════════════════════════════ */
/* JavaScript — all dynamic HTML built with string concatenation             */
/* ══════════════════════════════════════════════════════════════════════════ */

const JS = `
// ── state ──────────────────────────────────────────────────────────────────
var resetTimes = {};   // { providerId: resetAt (ms) | null }
var rwWindowEndMs = null;  // 15-min window end timestamp (ms)
var keyStatusData = null;  // latest /api/providers/status response
var alerts = [];
var alertId = 0;
var prev = {};
var sse = null;

// ── Bangkok timezone formatters (UTC+7 · Asia/Bangkok · Hanoi · HCM) ──────
var _bkkTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok', hour12: false,
  hour: '2-digit', minute: '2-digit', second: '2-digit'
});
var _bkkDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok', hour12: false,
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit'
});
function fmtTime(ts) {
  if (!ts) return '—';
  return _bkkTime.format(new Date(ts));        // → "13:10:45"
}
function fmtDateTime(ts) {
  if (!ts) return '—';
  return _bkkDateTime.format(new Date(ts));    // → "21/05/2026, 13:10:45"
}

// ── helpers ────────────────────────────────────────────────────────────────
function fmtMs(ms) {
  if (!ms || ms === 0) return '—';
  return ms < 1000 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's';
}

function timeAgo(ts) {
  if (!ts) return '—';
  var d = Date.now() - ts;
  if (d < 60000)  return Math.floor(d / 1000) + 's ago';
  if (d < 3600000) return Math.floor(d / 60000) + 'm ago';
  return fmtTime(ts);
}

function countdown(resetAt) {
  if (!resetAt) return null;
  var r = resetAt - Date.now();
  if (r <= 0) return '00:00:00';
  var h = Math.floor(r / 3600000);
  var m = Math.floor((r % 3600000) / 60000);
  var s = Math.floor((r % 60000) / 1000);
  return pad(h) + ':' + pad(m) + ':' + pad(s);
}
function pad(n) { return n < 10 ? '0' + n : '' + n; }

function pct(n, total) { return total ? Math.round(n / total * 100) : 0; }

function stateClass(s) {
  var m = { ACTIVE: 'b-active', STANDBY: 'b-standby', EXHAUSTED: 'b-exhausted',
            DEGRADED: 'b-degraded', BREAKER_OPEN: 'b-breaker_open' };
  return m[s] || 'b-unknown';
}
function dotClass(s) {
  var m = { ACTIVE: 'pd-active', STANDBY: 'pd-standby', EXHAUSTED: 'pd-exhausted',
            DEGRADED: 'pd-degraded', BREAKER_OPEN: 'pd-breaker_open' };
  return m[s] || 'pd-unknown';
}
function srCls(r) { return r >= 98 ? 'ok' : r >= 88 ? 'wn' : 'bd'; }
function latCls(ms) { return ms < 2000 ? 'ok' : ms < 5000 ? 'wn' : 'bd'; }

function get(id) { return document.getElementById(id); }
function setText(id, v) { var e = get(id); if (e) e.textContent = v; }
function setHtml(id, v) { var e = get(id); if (e) e.innerHTML = v; }

// ── alerts ─────────────────────────────────────────────────────────────────
function alert_(level, icon, text) {
  var id = alertId++;
  alerts.unshift({ id: id, level: level, icon: icon, text: text, ts: Date.now() });
  if (alerts.length > 15) alerts.pop();
  renderAlerts();
  if (level === 'info') setTimeout(function() {
    alerts = alerts.filter(function(a) { return a.id !== id; });
    renderAlerts();
  }, 30000);
}

function renderAlerts() {
  var el = get('a-list'), ct = get('alert-ct');
  if (!el) return;
  setText('alert-ct', alerts.length ? alerts.length + ' alert' + (alerts.length > 1 ? 's' : '') : 'no alerts');
  if (!alerts.length) { el.innerHTML = '<div class="nodata">No active alerts</div>'; return; }
  el.innerHTML = alerts.map(function(a) {
    return '<div class="aitem a-' + a.level + '">' +
      '<span class="aicon">' + a.icon + '</span>' +
      '<span class="atxt">' + a.text + '</span>' +
      '<span class="ats">' + timeAgo(a.ts) + '</span></div>';
  }).join('');
}

function checkAlerts(data) {
  var orch = data.orchestration, bk = data.breakers;
  if (orch && orch.providers) {
    orch.providers.forEach(function(p) {
      var k = p.provider, pv = prev[k] || {};
      if (p.state === 'EXHAUSTED' && pv.state !== 'EXHAUSTED')
        alert_('error', '🚨', k.toUpperCase() + ' quota EXHAUSTED — rotating to fallback provider');
      else if (p.remainingQuota <= 25 && p.totalQuota > 0 && (pv.remainingQuota == null || pv.remainingQuota > 25))
        alert_('warn', '⚠️', k.toUpperCase() + ' quota LOW: ' + p.remainingQuota + ' requests remaining');
      if (p.state === 'DEGRADED' && pv.state !== 'DEGRADED')
        alert_('warn', '⚡', k.toUpperCase() + ' DEGRADED — ' + p.consecutiveFailures + ' consecutive failures');
      prev[k] = p;
    });
  }
  if (bk && bk.providers) {
    Object.keys(bk.providers).forEach(function(pid) {
      var bs = bk.providers[pid], pv = prev['bk_' + pid] || {};
      if (bs.state === 'open' && pv.state !== 'open')
        alert_('error', '🔴', pid.toUpperCase() + ' circuit breaker OPEN — provider quarantined');
      else if (bs.state === 'half_open' && pv.state !== 'half_open')
        alert_('warn', '🟡', pid.toUpperCase() + ' circuit breaker HALF-OPEN — recovery probing');
      else if (bs.state === 'closed' && (pv.state === 'open' || pv.state === 'half_open'))
        alert_('info', '🟢', pid.toUpperCase() + ' circuit breaker RECOVERED → CLOSED');
      prev['bk_' + pid] = bs;
    });
  }
}

// ── render: API Key Status Table ─────────────────────────────────────────
function renderKeyTable(providers) {
  if (!providers || !providers.length) return;
  var totalKeys = 0, healthyKeys = 0, badKeys = 0;
  var rows = [];

  providers.forEach(function(prov) {
    if (!prov.keys || !prov.keys.length) return;
    prov.keys.forEach(function(k, idx) {
      totalKeys++;
      var isHealthy = k.status === 'healthy';
      if (isHealthy) healthyKeys++; else badKeys++;

      // Cooldown countdown
      var cdHtml = '';
      if (k.cooldownUntil) {
        var rem = Math.max(0, k.cooldownUntil - Date.now());
        if (rem > 0) {
          var m = Math.floor(rem/60000), s = Math.floor((rem%60000)/1000);
          cdHtml = '<span class="cd-pill" id="cd_' + prov.id + '_' + k.keyId + '">' + pad(m) + ':' + pad(s) + '</span>';
        }
      }

      // Last success / error labels
      var lastOk  = k.lastSuccessAt ? timeAgo(k.lastSuccessAt) : '—';
      var lastErr = k.lastErrorType ? '<span style="color:var(--red);font-size:9px">' + (k.lastErrorType || '') + '</span>' : '—';

      // Action buttons (disabled state depends on current status)
      var isDis = k.status === 'disabled' || k.status === 'auth_failed';
      var keySpec = prov.id + ':' + k.keyId;
      var btns =
        '<button class="btn-key ' + (isDis ? 'btn-key-en' : 'btn-key-dis') + '" onclick="doKeyAction(\'' + keySpec + '\',\'' + (isDis ? 'enable' : 'disable') + '\')">' +
          (isDis ? 'enable' : 'disable') +
        '</button>' +
        (!isDis && k.cooldownUntil ? '<button class="btn-key btn-key-rst" onclick="doKeyAction(\'' + keySpec + '\',\'reset-cooldown\')">reset</button>' : '');

      // Row border highlight for bad keys
      var rowStyle = isHealthy ? '' : ' style="border-left:2px solid var(--' + (k.status === 'auth_failed' ? 'red' : 'orange') + ')"';

      rows.push(
        '<tr' + rowStyle + '>' +
        '<td style="font-size:10px;letter-spacing:1px;text-transform:uppercase">' + (idx === 0 ? prov.id : '') + '</td>' +
        '<td><span class="key-id">' + k.keyId + '</span></td>' +
        '<td><span class="ks-' + k.status + '">' + k.status + '</span></td>' +
        '<td style="font-variant-numeric:tabular-nums">' + (k.totalRequests || 0) + '</td>' +
        '<td class="' + ((k.totalFailures||0) > 5 ? 'wn' : '') + '" style="font-variant-numeric:tabular-nums">' + (k.totalFailures || 0) + '</td>' +
        '<td style="font-size:10px">' + lastOk + '</td>' +
        '<td>' + lastErr + '</td>' +
        '<td>' + (cdHtml || '—') + '</td>' +
        '<td>' + btns + '</td>' +
        '</tr>'
      );
    });
  });

  if (!rows.length) {
    setHtml('key-table-body', '<tr><td colspan="9" class="nodata" style="padding:12px">No keys configured</td></tr>');
    setText('key-status-sum', 'no keys');
    return;
  }

  setHtml('key-table-body', rows.join(''));
  setText('key-status-sum', healthyKeys + ' healthy · ' + badKeys + ' degraded · ' + totalKeys + ' total');
}

function doKeyAction(keySpec, action) {
  fetch('/api/providers/keys/' + keySpec + '/' + action, { method: 'POST' })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.ok) {
        alert_('info', '🔑', keySpec + ' → ' + action + ' (' + (d.status || '') + ')');
        fetchKeyStatus();
      } else {
        alert_('error', '❌', 'Key action failed: ' + (d.error || 'unknown'));
      }
    })
    .catch(function(err) { alert_('error', '❌', 'Key request failed: ' + err.message); });
}

function fetchKeyStatus() {
  fetch('/api/providers/status')
    .then(function(r) { return r.json(); })
    .then(function(d) { keyStatusData = d; renderKeyTable(d.providers); })
    .catch(function() {});
}

// ── render: 15-min Rotation Window ───────────────────────────────────────
function renderRotationWindow(win) {
  if (!win) return;

  // Store end time for the live countdown ticker
  rwWindowEndMs = win.windowEndMs || null;

  var remaining = Math.max(0, (win.windowEndMs || 0) - Date.now());
  var total = 15 * 60 * 1000;
  var pct = total > 0 ? Math.max(0, Math.min(100, Math.round(remaining / total * 100))) : 0;
  var remSecs = Math.floor(remaining / 1000);
  var remMin = Math.floor(remSecs / 60);
  var remS   = remSecs % 60;
  var remStr = pad(remMin) + ':' + pad(remS);
  var remCls = remaining < 60000 ? 'crit' : remaining < 180000 ? 'low' : '';

  // SVG arc dial
  var r = 22, cx = 28, cy = 28, circ = 2 * Math.PI * r;
  var dashArr = (pct / 100 * circ).toFixed(1) + ' ' + circ.toFixed(1);
  var arcColor = remaining < 60000 ? 'var(--red)' : remaining < 180000 ? 'var(--yellow)' : 'var(--green)';

  setText('rw-remaining-hdr', 'remaining ' + remStr);

  // Build rotation sequence pills (4 windows: 0,1,2,3 → show all 4)
  var providers = win.primaryProvider && win.fallbackProvider
    ? [win.primaryProvider, win.fallbackProvider]
    : [];
  var slots = [0, 1, 2, 3].map(function(wid) {
    var pid = providers[wid % providers.length] || '?';
    var mins = pad(wid * 15) + ':00 - ' + pad(wid * 15 + 14) + ':59';
    var isCur = wid === (win.windowId != null ? win.windowId : -1);
    return (wid > 0 ? '<span class="rw-arr">→</span>' : '') +
      '<span class="rw-slot ' + (isCur ? 'rw-slot-active' : 'rw-slot-next') + '" title="' + mins + '">' +
        pid + '</span>';
  }).join('');

  setHtml('rw-body',
    '<div class="rw-wrap">' +
      '<div class="rw-clock">' +
        '<div class="rw-dial">' +
          '<svg width="56" height="56" viewBox="0 0 56 56">' +
            '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="5"/>' +
            '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + arcColor + '" stroke-width="5"' +
              ' stroke-dasharray="' + dashArr + '" stroke-linecap="round" style="transition:stroke-dasharray 1s linear"/>' +
          '</svg>' +
          '<div class="rw-dial-label" id="rw-dial-pct">' + pct + '%</div>' +
        '</div>' +
        '<div class="rw-info">' +
          '<div class="rw-win-label">Window ' + (win.windowId != null ? win.windowId : '?') + ' &nbsp;·&nbsp; ' + (win.windowLabel || '—') + '</div>' +
          '<div class="rw-primary">' + (win.primaryProvider || '—') + '</div>' +
          '<div class="rw-fallback">Fallback: ' + (win.fallbackProvider || '—') + '</div>' +
          '<div class="rw-remaining ' + remCls + '" id="rw-countdown">' + remStr + ' remaining</div>' +
        '</div>' +
      '</div>' +
      '<div class="rw-flow">' + slots + '</div>' +
    '</div>'
  );
}

// ── render: Active Rotation ────────────────────────────────────────────────
function renderRotation(orch) {
  if (!orch) return;
  var act = null, sby = null;
  (orch.providers || []).forEach(function(p) {
    if (p.state === 'ACTIVE') act = p;
    else if (p.state === 'STANDBY') sby = p;
  });
  setText('until-switch', (orch.requestsUntilSwitch || 0) + ' req until switch');
  if (!act && !sby) { setHtml('rot-body', '<div class="nodata">No rotation providers active</div>'); return; }
  var cur = act || sby;
  var bpct = cur.currentBatchLimit > 0 ? Math.round(cur.currentBatchUsage / cur.currentBatchLimit * 100) : 0;
  var flow = (orch.rotationOrder || []).map(function(id, i) {
    var p = (orch.providers || []).find(function(x) { return x.provider === id; });
    var isCur = p && p.state === 'ACTIVE';
    var arrow = i > 0 ? '<span class="rarr">→</span>' : '';
    return arrow + '<span class="rpill ' + (isCur ? 'rpill-cur' : 'rpill-nxt') + '">' +
      id + ' (' + (p ? p.currentBatchLimit : '?') + ')</span>';
  }).join('');

  setHtml('rot-body',
    '<div class="rot-wrap">' +
      '<div class="rot-top">' +
        '<div class="glow-dot' + (act ? '' : ' sd') + '"></div>' +
        '<div class="pname">' + cur.provider + '</div>' +
        '<span class="badge ' + stateClass(cur.state) + '">' + cur.state + '</span>' +
      '</div>' +
      '<div class="batch-row">' +
        '<div class="batch-hd"><span>Batch Progress</span><span class="batch-ct">' +
          cur.currentBatchUsage + ' / ' + cur.currentBatchLimit + '</span></div>' +
        '<div class="track"><div class="fill' + (act ? '' : ' sd-fill') + '" style="width:' + bpct + '%"></div></div>' +
      '</div>' +
      (sby ?
        '<div class="nxt"><span class="nxt-arr">→</span><span>Next:</span>' +
        '<span class="nxt-p">' + sby.provider.toUpperCase() + '</span>' +
        '<span style="color:var(--text-dim)">(' + sby.currentBatchLimit + ' req batch)</span></div>' : '') +
      '<div class="rot-flow">' + flow + '</div>' +
    '</div>'
  );
}

// ── render: Quota Table ────────────────────────────────────────────────────
function renderQuotaTable(providers) {
  if (!providers || !providers.length) return;
  setHtml('quota-body', providers.map(function(p) {
    var used = p.usedQuota, total = p.totalQuota;
    var upct = total > 0 ? Math.round(used / total * 100) : 0;
    var rtHtml = p.resetAt
      ? '<span id="qr_' + p.provider + '" class="rtimer rt-ok">—</span>'
      : '<span class="rtimer rt-ns">Window not started</span>';
    var cf = p.consecutiveFailures || 0;
    var tf = p.totalFailures || 0;
    var failCls = cf >= 5 ? 'bd' : cf >= 2 ? 'wn' : (tf > 0 ? 'wn' : 'ok');
    var failLabel = cf + ' consec / ' + tf + ' total';
    var errTip = p.lastError ? ' title="' + p.lastError.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,"'") + '"' : '';
    var failHtml = '<span class="' + failCls + '" style="font-size:10px;font-variant-numeric:tabular-nums"' + errTip + '>' +
      failLabel + (p.lastError ? ' ⚠' : '') + '</span>';
    var rowStyle = p.lastError ? ' style="border-left:2px solid var(--red)"' : (p.state === 'ACTIVE' ? ' style="border-left:2px solid var(--green)"' : '');
    var rows = '<tr' + rowStyle + '>' +
      '<td><div class="pcell"><div class="pdot ' + dotClass(p.state) + '"></div>' +
        '<span class="pn">' + p.provider + '</span></div></td>' +
      '<td style="font-variant-numeric:tabular-nums">' + used + '</td>' +
      '<td class="' + (p.remainingQuota < 25 ? 'bd' : p.remainingQuota < 50 ? 'wn' : '') +
        '" style="font-variant-numeric:tabular-nums">' + p.remainingQuota + '</td>' +
      '<td>' + total + '</td>' +
      '<td>' + rtHtml + '</td>' +
      '<td style="font-variant-numeric:tabular-nums">' + p.currentBatchUsage + '/' + p.currentBatchLimit + '</td>' +
      '<td>' + failHtml + '</td>' +
      '<td><span class="badge ' + stateClass(p.state) + '" style="font-size:8px">' + p.state + '</span></td>' +
      '</tr>';
    if (p.lastError) {
      rows += '<tr style="border-left:2px solid var(--red)"><td colspan="8" ' +
        'style="padding:3px 14px 5px;font-size:9px;color:var(--red);opacity:.85;letter-spacing:.3px">' +
        '↳ ' + p.lastError.slice(0, 140).replace(/</g,'&lt;') + '</td></tr>';
    }
    return rows;
  }).join(''));
}

// ── render: Window Timers ─────────────────────────────────────────────────
function renderTimerGrid(providers) {
  if (!providers || !providers.length) return;
  setHtml('timer-grid', providers.map(function(p) {
    var has = !!p.resetAt;
    return '<div class="tcard">' +
      '<div class="tn">' + p.provider + '</div>' +
      '<div class="td ' + (has ? 'ok' : 'ns') + '" id="timer_' + p.provider + '">' +
        (has ? '—' : 'Window not started') +
      '</div>' +
      '<div class="tl">' + (has ? 'until reset' : 'Starts on first request') + '</div>' +
    '</div>';
  }).join(''));
}

// ── render: Circuit Breakers ──────────────────────────────────────────────
function renderBreakers(bk) {
  if (!bk) return;
  setText('bk-sum',
    bk.totalOpen + ' open · ' + bk.totalHalfOpen + ' half-open · ' + bk.totalClosed + ' closed');
  var entries = Object.keys(bk.providers || {});
  if (!entries.length) { setHtml('bk-list', '<div class="nodata">No breaker data</div>'); return; }
  setHtml('bk-list', entries.map(function(pid) {
    var bs = bk.providers[pid];
    return '<div class="bkitem">' +
      '<span class="bkname">' + pid + '</span>' +
      '<div class="bkright">' +
        '<span class="bktrips">' + (bs.totalTrips || 0) + ' trips</span>' +
        '<span class="bkstate bk-' + bs.state + '">' + bs.state.replace('_', '-').toUpperCase() + '</span>' +
      '</div></div>';
  }).join(''));
}

// ── render: Performance ───────────────────────────────────────────────────
function renderPerf(orch, met, log) {
  var providers = (orch && orch.providers) || [];
  var nkq = providers.find(function(p) { return p.provider === 'antigravity'; }) || {};
  var opus = providers.find(function(p) { return p.provider === 'opusmax'; }) || {};
  var pm = (met && met.providers) || {};
  var nM = pm['antigravity'] || {};
  var oM = pm['opusmax'] || {};
  var nSR = nM.successRate != null ? Math.round(nM.successRate * 100) / 100 : null;
  var oSR = oM.successRate != null ? Math.round(oM.successRate * 100) / 100 : null;

  setHtml('perf-body',
    '<tr><td class="ml">Avg Latency</td>' +
      '<td class="' + latCls(nM.avgLatencyMs) + '">' + fmtMs(nM.avgLatencyMs) + '</td>' +
      '<td class="' + latCls(oM.avgLatencyMs) + '">' + fmtMs(oM.avgLatencyMs) + '</td>' +
      '<td class="' + latCls(met && met.latency && met.latency.avgMs) + '">' + fmtMs(met && met.latency && met.latency.avgMs) + '</td></tr>' +

    '<tr><td class="ml">p95 Latency</td><td>—</td><td>—</td>' +
      '<td class="' + latCls(met && met.latency && met.latency.p95Ms) + '">' + fmtMs(met && met.latency && met.latency.p95Ms) + '</td></tr>' +

    '<tr><td class="ml">Success Rate</td>' +
      '<td class="' + srCls(nSR) + '">' + (nSR != null ? nSR + '%' : '—') + '</td>' +
      '<td class="' + srCls(oSR) + '">' + (oSR != null ? oSR + '%' : '—') + '</td>' +
      '<td>—</td></tr>' +

    '<tr><td class="ml">Total Requests</td>' +
      '<td>' + (nkq.totalRequests != null ? nkq.totalRequests : (nM.requests != null ? nM.requests : '—')) + '</td>' +
      '<td>' + (opus.totalRequests != null ? opus.totalRequests : (oM.requests != null ? oM.requests : '—')) + '</td>' +
      '<td>' + ((met && met.requests && met.requests.total) || '—') + '</td></tr>' +

    '<tr><td class="ml">Failures</td>' +
      '<td class="' + ((nkq.totalFailures || 0) > 5 ? 'wn' : 'ok') + '">' + (nkq.totalFailures != null ? nkq.totalFailures : '—') + '</td>' +
      '<td class="' + ((opus.totalFailures || 0) > 5 ? 'wn' : 'ok') + '">' + (opus.totalFailures != null ? opus.totalFailures : '—') + '</td>' +
      '<td>' + ((met && met.requests && met.requests.error) || '—') + '</td></tr>' +

    '<tr><td class="ml">Consecutive Failures</td>' +
      '<td class="' + ((nkq.consecutiveFailures || 0) >= 3 ? 'bd' : 'ok') + '">' + (nkq.consecutiveFailures != null ? nkq.consecutiveFailures : '—') + '</td>' +
      '<td class="' + ((opus.consecutiveFailures || 0) >= 3 ? 'bd' : 'ok') + '">' + (opus.consecutiveFailures != null ? opus.consecutiveFailures : '—') + '</td>' +
      '<td>—</td></tr>' +

    '<tr><td class="ml">Streams Completed</td><td>—</td><td>—</td>' +
      '<td>' + ((met && met.streaming && met.streaming.completed) || '—') + '</td></tr>'
  );
}

// ── render: Timeline ──────────────────────────────────────────────────────
function renderTimeline(events) {
  if (!events || !events.length) { setHtml('tl-list', '<div class="nodata">No rotation events yet</div>'); return; }
  var sorted = events.slice().sort(function(a, b) { return b.timestamp - a.timestamp; });
  setHtml('tl-list', sorted.map(function(e) {
    var dc = tlDot(e.type), desc = tlDesc(e);
    return '<div class="tentry">' +
      '<span class="ttime">' + fmtTime(e.timestamp) + '</span>' +
      '<div class="tdotcol"><div class="tdot ' + dc + '"></div></div>' +
      '<div class="tcont"><div class="ttype">' + e.type + '</div><div class="tdesc">' + desc + '</div></div>' +
    '</div>';
  }).join(''));
}

function tlDot(type) {
  var m = {
    'quota.batch_switch':      'td-switch',
    'quota.batch_started':     'td-started',
    'quota.batch_completed':   'td-switch',
    'quota.provider_switched': 'td-switch',
    'quota.window_started':    'td-started',
    'quota.window_reset':      'td-reset',
    'quota.provider_exhausted':'td-exhausted',
    'quota.provider_degraded': 'td-degraded',
    'quota.state_reset':       'td-reset',
    'provider.fallback':       'td-fallback'
  };
  return m[type] || 'td-def';
}

function tlDesc(e) {
  var p = e.payload || {};
  switch (e.type) {
    case 'quota.batch_switch':
      return (p.fromProvider || '?') + ' → ' + (p.toProvider || '?') + ' (batch ' + p.batchSize + ')';
    case 'quota.batch_started':
      return (p.providerId || '?') + ' batch started — 0/' + p.batchSize + ' used';
    case 'quota.batch_completed':
      return (p.providerId || '?') + ' batch complete — ' + p.batchSize + ' req served';
    case 'quota.provider_switched':
      return (p.fromProvider || '?') + ' → ' + (p.toProvider || '?') + ' · trigger: ' + (p.trigger || 'batch_full');
    case 'quota.window_started':
      return (p.providerId || '?') + ' window started — resets in 5 h';
    case 'quota.window_reset':
      return (p.providerId || '?') + ' quota reset · window closed';
    case 'quota.provider_exhausted':
      return (p.providerId || '?') + ' exhausted (' + p.usedQuota + '/' + p.totalQuota + ')';
    case 'quota.provider_degraded':
      return (p.providerId || '?') + ' degraded — ' + p.consecutiveFailures + ' consecutive failures';
    case 'quota.state_reset':
      return p.scope === 'provider'
        ? (p.providerId || '?') + ' quota reset by operator'
        : 'Full orchestrator state reset by operator';
    case 'provider.fallback':
      return (p.fromProvider || '?') + ' failed → ' + (p.toProvider || '?');
    default:
      return JSON.stringify(p).slice(0, 55);
  }
}

// ── render: Distribution ──────────────────────────────────────────────────
function renderDist(log) {
  if (!log) return;
  var by = log.byProvider || {}, total = log.total || 0;
  setText('dist-total', total + ' req');
  var entries = Object.keys(by).sort(function(a, b) { return by[b] - by[a]; });
  if (!entries.length) { setHtml('dist-list', '<div class="nodata">No requests yet</div>'); return; }
  setHtml('dist-list', entries.map(function(pid) {
    var cnt = by[pid], p = pct(cnt, total);
    var fc = pid === 'antigravity' ? 'df-nkq' : pid === 'opusmax' ? 'df-opus' : 'df-other';
    return '<div class="ditem">' +
      '<div class="dhd"><span class="dp">' + pid + '</span><span class="dc">' + cnt + ' req</span></div>' +
      '<div class="dtrack"><div class="dfill ' + fc + '" style="width:' + p + '%"></div></div>' +
      '<div class="dpct">' + p + '%</div>' +
    '</div>';
  }).join(''));
}

// ── render: Health ────────────────────────────────────────────────────────
function renderHealth(met, log) {
  var st = (met && met.streaming) || {};
  var la = (met && met.latency) || {};
  var rq = (met && met.requests) || {};
  var errRate = rq.total ? Math.round(rq.error / rq.total * 100) : 0;
  var compRate = st.completionRate != null ? Math.round(st.completionRate * 100) : null;

  setHtml('h-grid',
    hitem('Active Req', rq.active != null ? rq.active : '—', rq.active > 20 ? 'wn' : 'ok') +
    hitem('Streams', st.total != null ? st.total : '—', 'ok') +
    hitem('Stream Completion', compRate != null ? compRate + '%' : '—', compRate != null && compRate < 90 ? 'wn' : 'ok') +
    hitem('p95 Latency', fmtMs(la.p95Ms), la.p95Ms > 5000 ? 'bd' : la.p95Ms > 2000 ? 'wn' : 'ok') +
    hitem('Error Rate', errRate + '%', errRate > 10 ? 'bd' : errRate > 3 ? 'wn' : 'ok') +
    hitem('Avg Latency (log)', fmtMs(log && log.avgLatency), (log && log.avgLatency) > 3000 ? 'wn' : 'ok')
  );
}
function hitem(label, val, cls) {
  return '<div class="hitem"><div class="hl">' + label + '</div><div class="hv ' + cls + '">' + val + '</div></div>';
}

// ── Countdown ticker ──────────────────────────────────────────────────────
function tickCountdowns() {
  Object.keys(resetTimes).forEach(function(pid) {
    var ra = resetTimes[pid];
    var cd = countdown(ra);
    var r = ra ? ra - Date.now() : 0;
    var cls = r < 1800000 ? 'crit' : r < 3600000 ? 'low' : 'ok';

    var qrEl = get('qr_' + pid);
    if (qrEl && cd != null) { qrEl.className = 'rtimer rt-' + cls; qrEl.textContent = cd; }

    var tEl = get('timer_' + pid);
    if (tEl && cd != null) { tEl.className = 'td ' + cls; tEl.textContent = cd; }
  });

  // Key cooldown pills
  if (keyStatusData && keyStatusData.providers) {
    keyStatusData.providers.forEach(function(prov) {
      (prov.keys || []).forEach(function(k) {
        if (!k.cooldownUntil) return;
        var el = get('cd_' + prov.id + '_' + k.keyId);
        if (!el) return;
        var rem = Math.max(0, k.cooldownUntil - Date.now());
        if (rem <= 0) { el.textContent = 'ready'; return; }
        var m = Math.floor(rem/60000), s = Math.floor((rem%60000)/1000);
        el.textContent = pad(m) + ':' + pad(s);
      });
    });
  }

  // 15-min rotation window countdown
  if (rwWindowEndMs) {
    var rem = Math.max(0, rwWindowEndMs - Date.now());
    var remMin = Math.floor(rem / 60000);
    var remSec = Math.floor((rem % 60000) / 1000);
    var str = pad(remMin) + ':' + pad(remSec);
    var cls2 = rem < 60000 ? 'crit' : rem < 180000 ? 'low' : '';
    var cdEl = get('rw-countdown');
    if (cdEl) { cdEl.className = 'rw-remaining ' + cls2; cdEl.textContent = str + ' remaining'; }
    var pctEl = get('rw-dial-pct');
    if (pctEl) { pctEl.textContent = Math.round(rem / (15 * 60 * 1000) * 100) + '%'; }
    setText('rw-remaining-hdr', 'remaining ' + str);
  }
}
setInterval(tickCountdowns, 1000);

// ── SSE ───────────────────────────────────────────────────────────────────
function connect() {
  if (sse) { try { sse.close(); } catch(e) {} }
  sse = new EventSource('/api/runtime/stream');

  sse.onopen = function() {
    get('ldot').className = 'ldot';
    get('llabel').textContent = 'LIVE';
    get('llabel').style.color = 'var(--green)';
    fetchKeyStatus();  // load key health immediately on connect
  };

  sse.onmessage = function(e) {
    try {
      var d = JSON.parse(e.data);
      setText('last-ts', 'updated ' + fmtTime(d.ts));

      // Collect reset timestamps
      if (d.orchestration && d.orchestration.providers) {
        d.orchestration.providers.forEach(function(p) {
          resetTimes[p.provider] = p.resetAt || null;
        });
      }

      updateHeaderStatus(d.orchestration, d.control);
      checkAlerts(d);
      renderControlCenter(d.control, d.allProviders, d.orchestration, d.breakers);
      renderRotationWindow(d.window);
      if (d.keyStatus) { keyStatusData = d.keyStatus; renderKeyTable(d.keyStatus.providers); }
      renderRotation(d.orchestration);
      renderQuotaTable(d.orchestration && d.orchestration.providers);
      renderTimerGrid(d.orchestration && d.orchestration.providers);
      renderBreakers(d.breakers);
      renderPerf(d.orchestration, d.metrics, d.logStats);
      renderTimeline(d.timeline);
      renderDist(d.logStats);
      renderHealth(d.metrics, d.logStats);
    } catch(err) {
      console.error('SSE parse error', err);
    }
  };

  sse.onerror = function() {
    get('ldot').className = 'ldot off';
    get('llabel').textContent = 'RECONNECTING';
    get('llabel').style.color = 'var(--red)';
    setTimeout(connect, 3000);
  };
}

// ── Header status line ────────────────────────────────────────────────────
function updateHeaderStatus(orch, ctrl) {
  var el = get('hdr-status');
  if (!el) return;

  var activeId = (ctrl && ctrl.activeProvider) || (orch && orch.currentActiveProvider) || '?';
  var label    = PROVIDER_LABELS[activeId] || activeId.toUpperCase();
  // Use the short name for header: strip " NKQ" suffix for cleanliness
  var shortLabel = label.replace(' NKQ', '').replace('Antigravity ', '').toUpperCase();

  el.innerHTML =
    'ACTIVE&nbsp;PROVIDER:&nbsp;' +
    '<span style="color:var(--green);letter-spacing:3px;font-size:11px">' + shortLabel + '</span>';
}

// ── Operator controls ─────────────────────────────────────────────────────
function doResetAll() {
  if (!confirm('Reset ALL quota orchestrator state?\n\nThis clears NKQ and OpusMax quota counters, batch counters, and rotation index.\nUse when you need a fresh start or after smoke tests contaminated the state.')) return;
  fetch('/api/runtime/reset', { method: 'POST' })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.ok) {
        alert_('warn', '⟳', 'Full quota reset — all counters zeroed. NKQ is now primary.');
        // Flash the quota panel
        var qb = get('quota-body');
        if (qb) { qb.classList.add('rst-flash'); setTimeout(function() { qb.classList.remove('rst-flash'); }, 600); }
      } else {
        alert_('error', '❌', 'Reset failed: ' + (d.error || 'unknown error'));
      }
    })
    .catch(function(err) {
      alert_('error', '❌', 'Reset request failed: ' + err.message);
    });
}

function doResetProvider(providerId) {
  if (!confirm('Reset quota for ' + providerId.toUpperCase() + '?\n\nThis clears that provider\'s quota counter, batch counter, and failure state only.')) return;
  fetch('/api/runtime/reset/' + providerId, { method: 'POST' })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.ok) {
        alert_('info', '⟳', providerId.toUpperCase() + ' quota reset — window and batch cleared.');
      } else {
        alert_('error', '❌', 'Reset failed: ' + (d.error || 'unknown error'));
      }
    })
    .catch(function(err) {
      alert_('error', '❌', 'Reset request failed: ' + err.message);
    });
}

// ── Provider Control Center ───────────────────────────────────────────────
var PROVIDER_LABELS = {
  'antigravity': 'Antigravity NKQ',
  'opusmax':     'OpusMax',
  'anthropic':   'Anthropic',
  'openrouter':  'OpenRouter',
  'ollama':      'Local / Ollama'
};

function renderControlCenter(ctrl, allProviders, orch, bk) {
  if (!ctrl) return;

  var mode = ctrl.mode || 'assisted-auto';
  var activeId = ctrl.activeProvider;
  var orchActive = orch && orch.currentActiveProvider;

  // ── Mode badge + hint ─────────────────────────────────────────────
  var badge = get('cc-mode-badge');
  var hint  = get('cc-mode-hint');
  if (badge) {
    badge.textContent = mode === 'manual' ? 'MANUAL' : 'ASSISTED AUTO';
    badge.className   = 'badge ' + (mode === 'manual' ? 'b-active' : 'b-standby');
  }
  if (hint) {
    hint.textContent = mode === 'manual'
      ? 'Operator override active · Router obeys this selection'
      : 'Orchestrator-managed rotation active · Click a provider to override';
  }

  // ── Big provider name ─────────────────────────────────────────────
  var displayId    = mode === 'manual' ? activeId : orchActive;
  var displayLabel = displayId ? (PROVIDER_LABELS[displayId] || displayId.toUpperCase()) : '—';
  var nameEl = get('cc-provider-name');
  if (nameEl) {
    if (mode === 'manual' && activeId) {
      nameEl.className = 'cc-active-name cc-manual';
      nameEl.textContent = displayLabel;
    } else {
      nameEl.className = 'cc-active-name cc-automode';
      nameEl.textContent = orchActive
        ? (PROVIDER_LABELS[orchActive] || orchActive.toUpperCase()) + ' (AUTO)'
        : 'AUTO';
    }
  }
  setText('cc-active-since',
    mode === 'manual' && ctrl.activeSince
      ? 'Active since ' + fmtDateTime(ctrl.activeSince) + ' · manual'
      : 'Orchestrator-managed rotation');

  // ── Live stats ────────────────────────────────────────────────────
  setText('cc-st-req', mode === 'manual' && ctrl.requestsRouted != null ? ctrl.requestsRouted : '—');
  setText('cc-st-lat', ctrl.avgLatencyMs ? fmtMs(ctrl.avgLatencyMs) : '—');

  var orchProv = displayId && orch && orch.providers
    ? orch.providers.find(function(p) { return p.provider === displayId; })
    : null;
  setText('cc-st-quota', orchProv
    ? orchProv.remainingQuota + '/' + orchProv.totalQuota
    : (displayId ? 'Unlimited' : '—'));

  var bkEntry = displayId && bk && bk.providers ? bk.providers[displayId] : null;
  var bkText  = bkEntry ? bkEntry.state.toUpperCase() : (displayId ? 'OK' : '—');
  var bkEl = get('cc-st-bk');
  if (bkEl) {
    bkEl.textContent = bkText;
    bkEl.style.color = bkEntry && bkEntry.state !== 'closed' ? 'var(--red)' : '';
  }

  // ── Provider table ────────────────────────────────────────────────
  var providers = allProviders || [];
  if (!providers.length) return;

  setHtml('cct-body', providers.map(function(p) {
    var isActive = p.id === activeId;
    var bkS      = bk && bk.providers && bk.providers[p.id] ? bk.providers[p.id].state : null;
    var orchState = orch && orch.providers ? orch.providers.find(function(op) { return op.provider === p.id; }) : null;

    // Status — circuit breaker > orchestrator > last error > healthy
    var lastErr = ctrl.providerErrors && ctrl.providerErrors[p.id];
    var statusText = 'Healthy', statusCls = 'b-standby';
    if      (bkS === 'open')                                         { statusText = 'Circuit Open';  statusCls = 'b-breaker_open'; }
    else if (bkS === 'half_open')                                    { statusText = 'Recovering';    statusCls = 'b-degraded';     }
    else if (orchState && orchState.state === 'EXHAUSTED')           { statusText = 'Exhausted';     statusCls = 'b-exhausted';    }
    else if (orchState && orchState.state === 'DEGRADED')            { statusText = 'Degraded';      statusCls = 'b-degraded';     }
    else if (lastErr && lastErr.type === 'auth_failed')              { statusText = 'Auth Failed';   statusCls = 'b-exhausted';    }
    else if (lastErr && lastErr.type === 'quota_exceeded')           { statusText = 'Quota Exceeded';statusCls = 'b-exhausted';    }
    else if (lastErr && lastErr.type === 'rate_limited')             { statusText = 'Rate Limited';  statusCls = 'b-degraded';     }
    else if (lastErr && lastErr.type === 'provider_down')            { statusText = 'Down';          statusCls = 'b-breaker_open'; }
    else if (lastErr && lastErr.type === 'invalid_model')            { statusText = 'Bad Model';     statusCls = 'b-degraded';     }
    else if (lastErr && lastErr.type === 'timeout')                  { statusText = 'Timeout';       statusCls = 'b-degraded';     }
    else if (lastErr)                                                { statusText = 'Error';         statusCls = 'b-degraded';     }
    else if (p.kind === 'ollama')                                    { statusText = 'Local';         statusCls = 'b-standby';      }
    else if (isActive)                                               { statusText = 'Online';        statusCls = 'b-active';       }

    // Active column — ✅ or ❌
    var activeHtml = isActive
      ? '<span style="font-size:14px" title="Currently routing all traffic here">✅</span>'
      : '<span style="font-size:14px;opacity:.35" title="Standby">❌</span>';

    // Action column — [ACTIVE] label or [Switch] button
    var actionHtml = isActive
      ? '<span class="badge b-active" style="font-size:8px;letter-spacing:2px">[ACTIVE]</span>'
      : '<button class="btn-activate btn" onclick="doSwitchProvider(\'' + p.id + '\')">[Switch]</button>';

    var rowStyle = isActive ? ' style="border-left:2px solid var(--green)"' : '';
    var labelText = p.label ? p.label : (PROVIDER_LABELS[p.id] || p.id);
    return '<tr' + rowStyle + '>' +
      '<td style="letter-spacing:1px">' + labelText + '</td>' +
      '<td><span class="badge ' + statusCls + '" style="font-size:8px">' + statusText + '</span></td>' +
      '<td style="text-align:center">' + activeHtml + '</td>' +
      '<td>' + actionHtml + '</td>' +
      '</tr>';
  }).join(''));
}

// ── Provider switching ────────────────────────────────────────────────────
function doSwitchProvider(providerId) {
  var label = PROVIDER_LABELS[providerId] || providerId;
  if (!confirm('Switch active provider to ' + label + '?\n\nAll new requests will route to this provider immediately.\nMode will switch to MANUAL.')) return;
  fetch('/api/runtime/provider/switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: providerId })
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.success) {
      alert_('info', '⚡', 'Switched to ' + label + ' · MANUAL mode active');
    } else {
      alert_('error', '❌', 'Switch failed: ' + (d.error || 'unknown'));
    }
  })
  .catch(function(err) { alert_('error', '❌', 'Switch request failed: ' + err.message); });
}

function doSetMode(mode) {
  var label = mode === 'assisted-auto' ? 'Assisted Auto' : 'Manual';
  fetch('/api/runtime/provider/mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: mode })
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.ok) {
      alert_('info', '↺', label + ' mode active · ' +
        (mode === 'assisted-auto' ? 'Orchestrator managing rotation' : 'Operator controls routing'));
    }
  })
  .catch(function(err) { alert_('error', '❌', 'Mode change failed: ' + err.message); });
}

function doEmergencyLocal() {
  if (!confirm('EMERGENCY: Route ALL traffic to Local Runtime (Ollama)?\n\nThis immediately bypasses all remote providers.\nUse during outages, quota exhaustion, or internet failure.')) return;
  fetch('/api/runtime/provider/switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'ollama' })
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.success) {
      alert_('warn', '🔴', 'EMERGENCY LOCAL MODE ACTIVE · All traffic → Ollama');
    } else {
      alert_('error', '❌', 'Emergency switch failed: ' + (d.error || 'Ollama provider may not be enabled'));
    }
  })
  .catch(function(err) { alert_('error', '❌', 'Emergency switch failed: ' + err.message); });
}

// ── Timeline dot/desc extensions for control events ──────────────────────
var _tlDotOrig = tlDot;
tlDot = function(type) {
  var ext = {
    'provider.manual_switch': 'td-switch',
    'provider.activated':     'td-started',
    'provider.deactivated':   'td-degraded',
    'provider.auto_suggest':  'td-fallback',
    'provider.failure':       'td-exhausted'
  };
  return ext[type] || _tlDotOrig(type);
};

var _tlDescOrig = tlDesc;
tlDesc = function(e) {
  var p = e.payload || {};
  switch (e.type) {
    case 'provider.manual_switch':
      return 'Manual switch: ' + (p.from || '?') + ' → ' + (p.to || '?') + ' · operator';
    case 'provider.activated':
      return (p.providerId || '?') + ' activated' + (p.operatorInitiated ? ' by operator' : ' (auto)');
    case 'provider.deactivated':
      return (p.providerId || '?') + ' deactivated' +
        (p.requestsRouted != null ? ' (' + p.requestsRouted + ' req served)' : '');
    case 'provider.auto_suggest':
      return 'Suggestion: switch to ' + (p.providerId || '?') + ' — ' + (p.reason || '');
    case 'provider.failure':
      return (p.providerId || '?') + ' FAILED [' + (p.model || '?') + ']: ' +
        (p.error ? p.error.slice(0, 60) : 'unknown error');
    default:
      return _tlDescOrig(e);
  }
};

connect();
setInterval(fetchKeyStatus, 5000);  // refresh key health every 5s
`;
