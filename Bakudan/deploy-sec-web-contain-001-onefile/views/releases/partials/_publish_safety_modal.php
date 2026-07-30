<?php
// Publish Safety Modal — blocks publish/schedule if checks fail
// Must be included from a view that has $publishCheck and $release available
$csrf = csrf_token();
?>
<div id="publishSafetyModal" class="modal-overlay" style="display:none">
    <div class="modal-box" style="max-width:520px">
        <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #27272a">
            <h3 style="margin:0;font-size:16px;color:#f4f4f5">Safety Check Before Publish</h3>
            <button onclick="closePublishSafetyModal()" style="background:none;border:none;color:#71717a;font-size:20px;cursor:pointer;padding:4px">&times;</button>
        </div>
        <div class="modal-body" style="padding:20px 24px">

            <?php if (!$publishCheck['allowed']): ?>
            <!-- BLOCKED STATE -->
            <div style="background:#450a0a;border:1px solid #7f1d1d;border-radius:8px;padding:16px;margin-bottom:16px">
                <div style="color:#fca5a5;font-size:14px;font-weight:600;margin-bottom:12px">Cannot publish — safety checks failed:</div>
                <ul style="margin:0;padding-left:20px;color:#fca5a5;font-size:13px;line-height:1.8">
                    <?php foreach ($publishCheck['reasons'] as $reason): ?>
                    <li><?= e($reason) ?></li>
                    <?php endforeach; ?>
                </ul>
            </div>

            <div style="background:#1c1c20;border-radius:8px;padding:14px;margin-bottom:16px">
                <div style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Required Actions</div>
                <?php foreach ($publishCheck['reasons'] as $reason): ?>
                <?php
                    $action = match(true) {
                        str_contains($reason, 'QA') => 'Mark QA as passed',
                        str_contains($reason, 'Walkthrough') => 'Complete all walkthroughs',
                        str_contains($reason, 'Confidence') => 'Set confidence score >= 70',
                        str_contains($reason, 'Approval') => 'Get approval from admin/CEO',
                        str_contains($reason, 'freeze') => 'End deploy freeze first',
                        default => 'Resolve issue',
                    };
                ?>
                <div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;color:#a1a1aa">
                    <span style="color:#fca5a5">&#10007;</span>
                    <span><?= e($action) ?></span>
                </div>
                <?php endforeach; ?>
            </div>

            <?php else: ?>
            <!-- READY STATE -->
            <div style="background:#052e16;border:1px solid #065f46;border-radius:8px;padding:16px;margin-bottom:16px">
                <div style="color:#4ade80;font-size:14px;font-weight:600;margin-bottom:12px">All safety checks passed</div>
                <div style="display:flex;flex-direction:column;gap:6px">
                    <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#86efac"><span>&#10003;</span> QA Passed</div>
                    <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#86efac"><span>&#10003;</span> Walkthrough Passed</div>
                    <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#86efac"><span>&#10003;</span> Confidence Above Threshold</div>
                    <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#86efac"><span>&#10003;</span> Approval Complete</div>
                    <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#86efac"><span>&#10003;</span> No Active Deploy Freeze</div>
                </div>
            </div>

            <div style="background:#1c1c20;border-radius:8px;padding:14px;margin-bottom:16px">
                <div style="font-size:13px;color:#a1a1aa;margin-bottom:8px">
                    Publishing <strong style="color:#f4f4f5"><?= e($release['name']) ?></strong>
                    (<?= e($release['version']) ?>) to production.
                </div>
                <div style="font-size:12px;color:#71717a">
                    This action will be logged in the audit trail and cannot be undone without a rollback.
                </div>
            </div>
            <?php endif; ?>

        </div>
        <div class="modal-footer" style="padding:16px 24px;border-top:1px solid #27272a;display:flex;gap:10px;justify-content:flex-end">
            <?php if (!$publishCheck['allowed']): ?>
            <button onclick="closePublishSafetyModal()" class="rd-btn rd-btn--ghost" style="width:auto">Close</button>
            <?php else: ?>
            <button onclick="closePublishSafetyModal()" class="rd-btn rd-btn--ghost" style="width:auto">Cancel</button>
            <button onclick="confirmPublish(<?= $release['id'] ?>)" class="rd-btn rd-btn--green" style="width:auto">Confirm Publish</button>
            <?php endif; ?>
        </div>
    </div>
</div>

<style>
.modal-overlay{position:fixed;inset:0;background:#09090b99;backdrop-filter:blur(4px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px}
.modal-box{background:#18181b;border:1px solid #27272a;border-radius:12px;width:100%;max-width:520px}
.modal-body{color:#f4f4f5}
.modal-footer{}
</style>

<script>
function openPublishSafetyModal() {
    document.getElementById('publishSafetyModal').style.display = 'flex';
}
function closePublishSafetyModal() {
    document.getElementById('publishSafetyModal').style.display = 'none';
}
function confirmPublish(id) {
    closePublishSafetyModal();
    transitionRelease(id, 'published');
}
document.getElementById('publishSafetyModal').addEventListener('click', function(e) {
    if (e.target === this) closePublishSafetyModal();
});
</script>
