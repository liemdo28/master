<?php
// Phase 11 — Module 8: Action Center View
// CEO sees ONLY what needs action
?>
<style>
.ac-hero {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 16px;
    padding: 32px;
    margin-bottom: 28px;
    border: 1px solid #2a2a3e;
    text-align: center;
}
.ac-hero h2 { font-size: 28px; font-weight: 700; color: #fff; margin: 0 0 8px; }
.ac-hero .subtitle { font-size: 14px; color: #9ca3af; margin-bottom: 20px; }
.ac-count { font-size: 56px; font-weight: 700; color: #fff; line-height: 1; }
.ac-count.zero { color: #00cc66; }
.ac-count.has-items { color: #ff4444; }

.ac-sections { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.ac-section { background: var(--card-bg, #18181b); border: 1px solid var(--border, #27272a); border-radius: 12px; padding: 20px; }
.ac-section h3 {
    font-size: 13px; font-weight: 600; color: var(--text-muted); margin: 0 0 14px;
    text-transform: uppercase; letter-spacing: 0.5px;
    display: flex; align-items: center; gap: 8px;
}
.ac-section h3 .count-badge {
    background: var(--accent, #dc2626); color: white; border-radius: 20px;
    padding: 2px 10px; font-size: 11px; font-weight: 600;
}
.ac-section h3 .count-badge.amber { background: #ffaa00; }

.ac-action-item {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 10px 0; border-bottom: 1px solid var(--border, #27272a);
}
.ac-action-item:last-child { border-bottom: none; }
.ac-priority-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
.ac-priority-dot.urgent { background: #ff4444; box-shadow: 0 0 6px #ff4444; }
.ac-priority-dot.high { background: #ff4444; }
.ac-priority-dot.medium { background: #ffaa00; }
.ac-priority-dot.low { background: #3b82f6; }
.ac-action-body { flex: 1; min-width: 0; }
.ac-action-title { font-size: 13px; font-weight: 500; color: var(--text-primary); }
.ac-action-desc { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.ac-action-detail { font-size: 11px; color: var(--accent); margin-top: 2px; }
.ac-action-link { font-size: 11px; color: #60a5fa; text-decoration: none; flex-shrink: 0; padding-top: 4px; }
.ac-action-link:hover { text-decoration: underline; }

.ac-type-chip {
    font-size: 10px; padding: 2px 7px; border-radius: 4px;
    background: rgba(255,255,255,0.05); color: var(--text-muted);
    text-transform: uppercase; letter-spacing: 0.5px; flex-shrink: 0; margin-top: 4px;
}

.empty-state { text-align: center; padding: 32px; color: var(--text-muted); }
.empty-state .emoji { font-size: 40px; margin-bottom: 8px; }
.empty-state p { font-size: 13px; }

@media (max-width: 900px) { .ac-sections { grid-template-columns: 1fr; } }
</style>

<div class="ac-hero">
    <h2>Action Center</h2>
    <p class="subtitle"><?= e($today) ?> &mdash; CEO dashboard: only what needs you</p>
    <div class="ac-count <?= $totalActions === 0 ? 'zero' : 'has-items' ?>">
        <?= $totalActions ?>
    </div>
    <p style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin:8px 0 0">
        <?= $totalActions === 0 ? 'All clear — nothing needs your attention' : 'items need your attention' ?>
    </p>
</div>

<div class="ac-sections">
    <!-- LEFT COLUMN -->
    <div>
        <!-- Need Approval -->
        <div class="ac-section">
            <h3>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffaa00" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                Need Approval
                <?php if (!empty($pendingApprovals)): ?>
                    <span class="count-badge"><?= count($pendingApprovals) ?></span>
                <?php endif; ?>
            </h3>
            <?php if (empty($pendingApprovals)): ?>
                <div class="empty-state"><div class="emoji">✅</div><p>Nothing pending approval</p></div>
            <?php else: ?>
                <?php foreach ($pendingApprovals as $item): ?>
                    <div class="ac-action-item">
                        <div class="ac-priority-dot <?= e($item['priority']) ?>"></div>
                        <div class="ac-action-body">
                            <div class="ac-action-title"><?= e($item['title']) ?></div>
                            <div class="ac-action-desc"><?= e($item['description']) ?></div>
                            <div class="ac-action-detail"><?= e($item['detail']) ?></div>
                        </div>
                        <span class="ac-type-chip"><?= e($item['type']) ?></span>
                        <a href="<?= e($item['url']) ?>" class="ac-action-link">Review →</a>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>

        <!-- Need Escalation -->
        <div class="ac-section">
            <h3>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff4444" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                Need Escalation
                <?php if (!empty($needsEscalation)): ?>
                    <span class="count-badge"><?= count($needsEscalation) ?></span>
                <?php endif; ?>
            </h3>
            <?php if (empty($needsEscalation)): ?>
                <div class="empty-state"><div class="emoji">👍</div><p>No escalations needed</p></div>
            <?php else: ?>
                <?php foreach ($needsEscalation as $item): ?>
                    <div class="ac-action-item">
                        <div class="ac-priority-dot urgent"></div>
                        <div class="ac-action-body">
                            <div class="ac-action-title"><?= e($item['title']) ?></div>
                            <div class="ac-action-desc"><?= e($item['description']) ?></div>
                            <div class="ac-action-detail"><?= e($item['detail']) ?></div>
                        </div>
                        <a href="<?= e($item['url']) ?>" class="ac-action-link">Fix →</a>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
    </div>

    <!-- RIGHT COLUMN -->
    <div>
        <!-- Need Review -->
        <div class="ac-section">
            <h3>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Need Review
                <?php if (!empty($needsReview)): ?>
                    <span class="count-badge"><?= count($needsReview) ?></span>
                <?php endif; ?>
            </h3>
            <?php if (empty($needsReview)): ?>
                <div class="empty-state"><div class="emoji">👀</div><p>Nothing in review</p></div>
            <?php else: ?>
                <?php foreach ($needsReview as $item): ?>
                    <div class="ac-action-item">
                        <div class="ac-priority-dot <?= e($item['priority']) ?>"></div>
                        <div class="ac-action-body">
                            <div class="ac-action-title"><?= e($item['title']) ?></div>
                            <div class="ac-action-desc"><?= e($item['description']) ?></div>
                        </div>
                        <a href="<?= e($item['url']) ?>" class="ac-action-link">View →</a>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>

        <!-- Need Attention -->
        <div class="ac-section">
            <h3>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Need Attention
                <?php if (!empty($needsAttention)): ?>
                    <span class="count-badge"><?= count($needsAttention) ?></span>
                <?php endif; ?>
            </h3>
            <?php if (empty($needsAttention)): ?>
                <div class="empty-state"><div class="emoji">🎯</div><p>All caught up</p></div>
            <?php else: ?>
                <?php foreach ($needsAttention as $item): ?>
                    <div class="ac-action-item">
                        <div class="ac-priority-dot <?= e($item['priority']) ?>"></div>
                        <div class="ac-action-body">
                            <div class="ac-action-title"><?= e($item['title']) ?></div>
                            <div class="ac-action-desc"><?= e($item['description']) ?></div>
                            <div class="ac-action-detail" style="<?= !empty($item['is_overdue']) ? 'color:#ff4444' : '' ?>">
                                <?= e($item['detail']) ?>
                            </div>
                        </div>
                        <a href="<?= e($item['url']) ?>" class="ac-action-link">Handle →</a>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
    </div>
</div>
