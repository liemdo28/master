<?php
// Version Details Modal — shows current production version info
// Called from sidebar footer or anywhere admin wants to see version info
// Requires: $release (the current live release data) passed in
if (!isset($release)) {
    $releaseModel = new Release();
    $release = $releaseModel->getCurrentLiveVersion();
}
?>
<div id="versionDetailsModal" class="modal-overlay" style="display:none;z-index:2000">
    <div class="modal-box" style="max-width:600px">
        <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #27272a">
            <div style="display:flex;align-items:center;gap:12px">
                <span style="font-size:20px">&#128640;</span>
                <div>
                    <h3 style="margin:0;font-size:15px;color:#f4f4f5">Production Version</h3>
                    <div style="font-size:12px;color:#71717a;margin-top:2px">Currently running on production</div>
                </div>
            </div>
            <button onclick="closeVersionDetailsModal()" style="background:none;border:none;color:#71717a;font-size:22px;cursor:pointer;padding:4px;line-height:1">&times;</button>
        </div>
        <div class="modal-body" style="padding:20px 24px;max-height:70vh;overflow-y:auto">

            <?php if ($release): ?>
            <!-- Version Hero -->
            <div style="background:linear-gradient(135deg,#052e16,#064e3b);border-radius:10px;padding:20px;margin-bottom:16px;text-align:center">
                <div style="font-family:monospace;font-size:28px;font-weight:700;color:#4ade80;margin-bottom:4px">
                    <?= e($release['version']) ?>
                </div>
                <div style="font-size:14px;color:#86efac"><?= e($release['name'] ?? $release['title'] ?? 'Production Release') ?></div>
                <div style="display:flex;justify-content:center;gap:16px;margin-top:12px;flex-wrap:wrap">
                    <?php
                    $confLetter = (new Release())->computeConfidenceLetter($release['confidence_score']);
                    $confColor = match($confLetter) { 'S' => '#f59e0b', 'A' => '#34d399', 'B' => '#60a5fa', 'C' => '#fbbf24', default => '#f87171' };
                    ?>
                    <div style="text-align:center">
                        <div style="font-size:20px;font-weight:700;color:<?= $confColor ?>"><?= e($confLetter ?: '—') ?></div>
                        <div style="font-size:10px;color:#86efac;text-transform:uppercase;letter-spacing:.5px">Confidence</div>
                    </div>
                    <div style="text-align:center">
                        <div style="font-size:20px;font-weight:700;color:#34d399"><?= $release['qa_score'] !== null ? number_format($release['qa_score'],0).'%' : '—' ?></div>
                        <div style="font-size:10px;color:#86efac;text-transform:uppercase;letter-spacing:.5px">QA Score</div>
                    </div>
                    <div style="text-align:center">
                        <div style="font-size:20px;font-weight:700;color:#4ade80"><?= e($release['qa_pass'] ? 'PASS' : 'FAIL') ?></div>
                        <div style="font-size:10px;color:#86efac;text-transform:uppercase;letter-spacing:.5px">QA Status</div>
                    </div>
                </div>
            </div>

            <!-- Meta Grid -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
                <div style="background:#09090b;border-radius:8px;padding:12px">
                    <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Published At</div>
                    <div style="font-size:13px;color:#f4f4f5">
                        <?= $release['published_at'] ? date('M j, Y g:i A', strtotime($release['published_at'])) : '—' ?>
                    </div>
                </div>
                <div style="background:#09090b;border-radius:8px;padding:12px">
                    <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Published By</div>
                    <div style="font-size:13px;color:#f4f4f5"><?= e($release['published_by_name'] ?? '—') ?></div>
                </div>
                <div style="background:#09090b;border-radius:8px;padding:12px">
                    <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Git Commit</div>
                    <div style="font-size:12px;color:#a78bfa;font-family:monospace">
                        <?= e($release['commit_hash'] ? substr($release['commit_hash'], 0, 8) : '—') ?>
                    </div>
                </div>
                <div style="background:#09090b;border-radius:8px;padding:12px">
                    <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Branch</div>
                    <div style="font-size:13px;color:#f4f4f5"><?= e($release['branch'] ?? '—') ?></div>
                </div>
            </div>

            <!-- Walkthrough Status -->
            <div style="margin-bottom:16px">
                <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Walkthrough Status</div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px">
                    <?php foreach (['ceo','manager','member','admin'] as $role): ?>
                    <?php
                    $status = $release['walkthrough_'.$role] ?? 'pending';
                    $colors = ['pass' => '#052e16', 'fail' => '#450a0a', 'pending' => '#18181b'];
                    $textColors = ['pass' => '#4ade80', 'fail' => '#fca5a5', 'pending' => '#71717a'];
                    ?>
                    <div style="background:<?= $colors[$status] ?>;border-radius:6px;padding:8px;text-align:center">
                        <div style="font-size:12px;font-weight:600;color:<?= $textColors[$status] ?>;text-transform:uppercase">
                            <?= e(substr(ucfirst($role), 0, 3)) ?>
                        </div>
                        <div style="font-size:10px;color:<?= $textColors[$status] ?>;margin-top:2px"><?= e($status) ?></div>
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>

            <!-- Release Notes Summary -->
            <?php if (!empty($release['release_notes']) || !empty($release['summary'])): ?>
            <div style="background:#09090b;border-radius:8px;padding:14px">
                <div style="font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Release Notes</div>
                <div style="font-size:13px;color:#d4d4d8;line-height:1.6;max-height:120px;overflow-y:auto">
                    <?= e($release['summary'] ?: $release['release_notes']) ?>
                </div>
            </div>
            <?php endif; ?>

            <?php else: ?>
            <div style="text-align:center;padding:40px;color:#71717a">
                <div style="font-size:32px;margin-bottom:12px">&#128640;</div>
                <div style="font-size:15px;color:#a1a1aa;margin-bottom:4px">No production version detected</div>
                <div style="font-size:13px">No release has been published to production yet.</div>
            </div>
            <?php endif; ?>

        </div>
        <div class="modal-footer" style="padding:16px 24px;border-top:1px solid #27272a;display:flex;gap:10px;justify-content:flex-end">
            <?php if ($release && $release['preview_url']): ?>
            <a href="<?= e($release['preview_url']) ?>" target="_blank" class="rd-btn rd-btn--ghost" style="width:auto;text-decoration:none">Preview</a>
            <?php endif; ?>
            <a href="<?= APP_URL ?>/admin/releases" class="rd-btn rd-btn--blue" style="width:auto;text-decoration:none">All Releases</a>
            <button onclick="closeVersionDetailsModal()" class="rd-btn rd-btn--ghost" style="width:auto">Close</button>
        </div>
    </div>
</div>

<script>
function openVersionDetailsModal() {
    document.getElementById('versionDetailsModal').style.display = 'flex';
}
function closeVersionDetailsModal() {
    document.getElementById('versionDetailsModal').style.display = 'none';
}
document.getElementById('versionDetailsModal').addEventListener('click', function(e) {
    if (e.target === this) closeVersionDetailsModal();
});
</script>
