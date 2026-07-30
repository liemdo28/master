<?php
// Phase 11 — Module 9: Playbooks Index View
?>
<style>
.pb-hero {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 16px; padding: 28px; margin-bottom: 24px; border: 1px solid #2a2a3e;
}
.pb-hero h2 { font-size: 24px; font-weight: 700; color: #fff; margin: 0 0 6px; }
.pb-hero p { font-size: 13px; color: #9ca3af; margin: 0; }
.pb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.pb-card {
    background: var(--card-bg, #18181b); border: 1px solid var(--border, #27272a);
    border-radius: 12px; padding: 20px; cursor: pointer; transition: border-color 0.2s;
}
.pb-card:hover { border-color: var(--accent, #3b82f6); }
.pb-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
.pb-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
.pb-desc { font-size: 13px; color: var(--text-muted); margin-bottom: 14px; line-height: 1.4; }
.pb-steps { font-size: 11px; color: var(--text-muted); }
.pb-steps span { color: var(--text-primary); font-weight: 500; }
.pb-compliance { margin-top: 16px; }
.pb-comp-bar { height: 6px; background: #27272a; border-radius: 6px; overflow: hidden; margin-top: 6px; }
.pb-comp-fill { height: 100%; border-radius: 6px; background: #00cc66; transition: width 0.3s; }
.pb-comp-text { font-size: 11px; color: var(--text-muted); }
</style>

<div class="pb-hero">
    <h2>Franchise Playbooks</h2>
    <p>Standardized procedures — assign, train, track compliance</p>
</div>

<!-- Compliance Summary -->
<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:24px">
    <h3 style="font-size:13px;font-weight:600;color:var(--text-muted);margin:0 0 12px;text-transform:uppercase;letter-spacing:0.5px">7-Day Compliance</h3>
    <div style="display:flex;align-items:center;gap:16px">
        <div style="font-size:32px;font-weight:700;color:#00cc66"><?= $compliance['rate'] ?>%</div>
        <div style="flex:1">
            <div style="height:8px;background:#27272a;border-radius:8px;overflow:hidden">
                <div style="height:100%;width:<?= $compliance['rate'] ?>%;background:#00cc66;border-radius:8px"></div>
            </div>
        </div>
        <div style="font-size:12px;color:var(--text-muted)"><?= $compliance['completed'] ?>/<?= $compliance['total'] ?> completed</div>
    </div>
</div>

<div class="pb-grid">
    <?php foreach ($playbooks as $p): ?>
        <div class="pb-card" onclick="location.href='/playbooks/<?= e($p['key']) ?>'">
            <div class="pb-icon" style="background:<?= e($p['color']) ?>20;color:<?= e($p['color']) ?>">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <?php if ($p['icon'] === 'sun'): ?>
                        <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                    <?php elseif ($p['icon'] === 'moon'): ?>
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    <?php elseif ($p['icon'] === 'dollar'): ?>
                        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    <?php elseif ($p['icon'] === 'package'): ?>
                        <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <?php elseif ($p['icon'] === 'shield'): ?>
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <?php endif; ?>
                </svg>
            </div>
            <div class="pb-title"><?= e($p['title']) ?></div>
            <div class="pb-desc"><?= e($p['description']) ?></div>
            <div class="pb-steps"><span><?= count($p['steps']) ?></span> steps</div>
        </div>
    <?php endforeach; ?>
</div>
