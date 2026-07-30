<?php
// Sidebar for release detail (right column) — Actions, Protection, Links
$releaseModel = new Release();
$csrf = csrf_token();
?>

<!-- Actions -->
<div class="rd-card">
    <h3>Actions</h3>
    <div class="rd-actions" style="flex-direction:column">
        <?php
        $transitions = Release::TRANSITIONS[$release['status']] ?? [];
        foreach ($transitions as $target):
            $btnClass = match($target) {
                'published' => 'rd-btn--green',
                'approved' => 'rd-btn--green',
                'rolled_back' => 'rd-btn--red',
                'changes_requested' => 'rd-btn--yellow',
                'scheduled' => 'rd-btn--blue',
                default => 'rd-btn--ghost',
            };
            $icon = match($target) {
                'published' => '🚀',
                'approved' => '✓',
                'rolled_back' => '↩',
                'changes_requested' => '⚠',
                'scheduled' => '📅',
                'ready_for_review' => '👁',
                'qa_running' => '🧪',
                'qa_passed' => '✅',
                'archived' => '📦',
                'draft' => '✏️',
                default => '→',
            };
        ?>
        <?php if ($target === 'published'): ?>
        <button class="rd-btn <?= $btnClass ?>" style="width:100%;justify-content:center" onclick="openPublishSafetyModal()">
            <?= $icon ?> Publish Now
        </button>
        <?php elseif ($target === 'scheduled'): ?>
        <button class="rd-btn <?= $btnClass ?>" style="width:100%;justify-content:center" onclick="transitionRelease(<?= $release['id'] ?>,'scheduled')">
            <?= $icon ?> Schedule Publish
        </button>
        <?php elseif ($target === 'rolled_back'): ?>
        <button class="rd-btn <?= $btnClass ?>" style="width:100%;justify-content:center" onclick="if(confirm('Rollback this release to draft?'))transitionRelease(<?= $release['id'] ?>,'rolled_back')">
            <?= $icon ?> Rollback
        </button>
        <?php else: ?>
        <button class="rd-btn <?= $btnClass ?>" style="width:100%;justify-content:center" onclick="transitionRelease(<?= $release['id'] ?>,'<?= $target ?>')">
            <?= $icon ?> <?= ucwords(str_replace('_',' ',$target)) ?>
        </button>
        <?php endif; ?>
        <?php endforeach; ?>
    </div>

    <?php if (in_array($release['status'], ['approved','scheduled']) && canAdmin()): ?>
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid #27272a">
        <h3 style="font-size:13px;color:#a1a1aa;margin:0 0 10px">Schedule Publication</h3>
        <div class="rd-form-row">
            <label>Date & Time</label>
            <input type="datetime-local" id="scheduleAt" value="<?= $release['scheduled_at'] ? date('Y-m-d\TH:i', strtotime($release['scheduled_at'])) : '' ?>">
        </div>
        <div class="rd-form-row">
            <label>Timezone</label>
            <select id="scheduleTz">
                <option value="Asia/Ho_Chi_Minh" <?= ($release['scheduled_timezone'] ?? '') === 'Asia/Ho_Chi_Minh' ? 'selected' : '' ?>>Asia/Ho_Chi_Minh (UTC+7)</option>
                <option value="America/Los_Angeles" <?= ($release['scheduled_timezone'] ?? '') === 'America/Los_Angeles' ? 'selected' : '' ?>>America/Los_Angeles (PST)</option>
                <option value="America/New_York" <?= ($release['scheduled_timezone'] ?? '') === 'America/New_York' ? 'selected' : '' ?>>America/New_York (EST)</option>
                <option value="UTC" <?= ($release['scheduled_timezone'] ?? '') === 'UTC' ? 'selected' : '' ?>>UTC</option>
            </select>
        </div>
        <button class="rd-btn rd-btn--blue" style="width:100%;justify-content:center" onclick="scheduleRelease(<?= $release['id'] ?>)">📅 Schedule</button>
        <?php if ($release['status'] === 'scheduled'): ?>
        <button class="rd-btn rd-btn--ghost" style="width:100%;justify-content:center;margin-top:8px" onclick="cancelSchedule(<?= $release['id'] ?>)">Cancel Schedule</button>
        <?php endif; ?>
    </div>
    <?php endif; ?>
</div>

<!-- Production Protection -->
<div class="rd-card">
    <h3>Production Protection</h3>
    <div class="rd-protect">
        <?php
        $checks = [
            ['label' => 'QA Pass', 'pass' => (bool)$release['qa_pass']],
            ['label' => 'Walkthrough Pass', 'pass' => (bool)$release['walkthrough_pass']],
            ['label' => 'Confidence Pass', 'pass' => (bool)$release['confidence_pass']],
            ['label' => 'No Active Freeze', 'pass' => (bool)$release['no_active_freeze']],
            ['label' => 'Approval Complete', 'pass' => (bool)$release['approval_complete']],
        ];
        foreach ($checks as $check):
        ?>
        <div class="rd-protect-item">
            <span class="rd-protect-icon rd-protect-icon--<?= $check['pass'] ? 'pass' : 'fail' ?>"><?= $check['pass'] ? '✓' : '✗' ?></span>
            <span style="color:<?= $check['pass'] ? '#d4d4d8' : '#fca5a5' ?>"><?= $check['label'] ?></span>
        </div>
        <?php endforeach; ?>
    </div>
    <?php if (!$publishCheck['allowed']): ?>
    <div style="margin-top:12px;padding:10px;background:#450a0a;border-radius:6px;font-size:12px;color:#fca5a5">
        ⚠ Cannot publish: <?= implode(', ', $publishCheck['reasons']) ?>
    </div>
    <?php else: ?>
    <div style="margin-top:12px;padding:10px;background:#052e16;border-radius:6px;font-size:12px;color:#4ade80">
        ✓ All checks passed — ready to publish
    </div>
    <?php endif; ?>
</div>

<!-- Shareable Links -->
<div class="rd-card">
    <h3>Review Links</h3>
    <?php if (!empty($links)): ?>
    <?php foreach ($links as $link): ?>
    <div class="rd-link-item">
        <div>
            <div class="rd-link-url"><?= APP_URL ?>/release/review/<?= e($link['token']) ?></div>
            <div style="font-size:11px;color:#71717a;margin-top:2px">
                <?= ucwords(str_replace('_',' ',$link['type'])) ?>
                <?php if ($link['label']): ?> · <?= e($link['label']) ?><?php endif; ?>
                <?php if ($link['expires_at']): ?> · Expires <?= date('M j', strtotime($link['expires_at'])) ?><?php endif; ?>
            </div>
        </div>
        <?php if ($link['is_active']): ?>
        <button class="rd-btn rd-btn--ghost" style="padding:4px 8px;font-size:11px" onclick="deactivateLink(<?= $link['id'] ?>)">✗</button>
        <?php else: ?>
        <span style="font-size:11px;color:#71717a">Inactive</span>
        <?php endif; ?>
    </div>
    <?php endforeach; ?>
    <?php endif; ?>

    <?php if (canAdmin()): ?>
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #27272a">
        <div class="rd-form-row">
            <label>Link Type</label>
            <select id="linkType">
                <option value="view_only">View Only (CEO/Stakeholders)</option>
                <option value="internal_review">Internal Review (can comment)</option>
            </select>
        </div>
        <div class="rd-form-row">
            <label>Label (optional)</label>
            <input type="text" id="linkLabel" placeholder="e.g. For CEO review">
        </div>
        <div class="rd-form-row">
            <label>Expires</label>
            <select id="linkExpiry">
                <option value="">Never</option>
                <option value="24h">24 hours</option>
                <option value="3d">3 days</option>
                <option value="7d">7 days</option>
            </select>
        </div>
        <button class="rd-btn rd-btn--blue" style="width:100%;justify-content:center" onclick="createLink(<?= $release['id'] ?>)">🔗 Generate Link</button>
    </div>
    <?php endif; ?>
</div>

<!-- JavaScript for AJAX actions -->
<script>
const CSRF = '<?= $csrf ?>';
const BASE = '<?= APP_URL ?>';

function transitionRelease(id, status) {
    let reason = '';
    if (['rolled_back','changes_requested'].includes(status)) {
        reason = prompt('Reason (optional):') || '';
    }
    fetch(`${BASE}/api/admin/releases/${id}/transition`, {
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},
        body:`csrf_token=${CSRF}&status=${status}&reason=${encodeURIComponent(reason)}`
    }).then(r=>r.json()).then(d=>{
        if(d.success) location.reload();
        else alert(d.error + (d.reasons ? '\n• '+d.reasons.join('\n• ') : ''));
    });
}

function scheduleRelease(id) {
    const at = document.getElementById('scheduleAt').value;
    const tz = document.getElementById('scheduleTz').value;
    if(!at){alert('Select a date/time');return;}
    fetch(`${BASE}/api/admin/releases/${id}/schedule`, {
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},
        body:`csrf_token=${CSRF}&scheduled_at=${at}&timezone=${tz}`
    }).then(r=>r.json()).then(d=>{
        if(d.success) location.reload();
        else alert(d.error);
    });
}

function cancelSchedule(id) {
    if(!confirm('Cancel scheduled publication?')) return;
    fetch(`${BASE}/api/admin/releases/${id}/cancel-schedule`, {
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},
        body:`csrf_token=${CSRF}`
    }).then(r=>r.json()).then(d=>{ if(d.success) location.reload(); });
}

function addReview(id, type) {
    const body = document.getElementById('reviewBody').value;
    fetch(`${BASE}/api/admin/releases/${id}/review`, {
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},
        body:`csrf_token=${CSRF}&type=${type}&body=${encodeURIComponent(body)}`
    }).then(r=>r.json()).then(d=>{
        if(d.success) location.reload();
        else alert(d.error);
    });
}

function createLink(id) {
    const type = document.getElementById('linkType').value;
    const label = document.getElementById('linkLabel').value;
    const expiry = document.getElementById('linkExpiry').value;
    fetch(`${BASE}/api/admin/releases/${id}/link`, {
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},
        body:`csrf_token=${CSRF}&type=${type}&label=${encodeURIComponent(label)}&expiry=${expiry}`
    }).then(r=>r.json()).then(d=>{
        if(d.success){
            prompt('Share this link:', d.url);
            location.reload();
        } else alert(d.error);
    });
}

function deactivateLink(linkId) {
    if(!confirm('Deactivate this link?')) return;
    fetch(`${BASE}/api/admin/releases/links/${linkId}/deactivate`, {
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},
        body:`csrf_token=${CSRF}`
    }).then(r=>r.json()).then(d=>{ if(d.success) location.reload(); });
}

function updateWalkthrough(id, role, status) {
    fetch(`${BASE}/api/admin/releases/${id}/walkthrough`, {
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},
        body:`csrf_token=${CSRF}&role=${role}&status=${status}`
    }).then(r=>r.json()).then(d=>{ if(d.success) location.reload(); });
}

function updateScores(id) {
    const qa = document.getElementById('qaScoreInput').value;
    const conf = document.getElementById('confScoreInput').value;
    fetch(`${BASE}/api/admin/releases/${id}/scores`, {
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},
        body:`csrf_token=${CSRF}&qa_score=${qa}&confidence_score=${conf}`
    }).then(r=>r.json()).then(d=>{ if(d.success) location.reload(); else alert(d.error); });
}
</script>
