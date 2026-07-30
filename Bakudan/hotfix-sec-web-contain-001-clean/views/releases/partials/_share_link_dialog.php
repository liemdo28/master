<?php
// Share Link Dialog — copy link + send to role
// Must be included from a view that has $links and $release available
$csrf = csrf_token();
?>
<div id="shareLinkDialog" class="modal-overlay" style="display:none">
    <div class="modal-box" style="max-width:560px">
        <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #27272a">
            <h3 style="margin:0;font-size:16px;color:#f4f4f5">Share Review Link</h3>
            <button onclick="closeShareLinkDialog()" style="background:none;border:none;color:#71717a;font-size:20px;cursor:pointer;padding:4px">&times;</button>
        </div>
        <div class="modal-body" style="padding:20px 24px">

            <!-- Quick share buttons -->
            <div style="margin-bottom:20px">
                <div style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Quick Share</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="share-role-btn" onclick="generateAndShare('ceo')" style="padding:8px 14px;background:#1c1c20;border:1px solid #3f3f46;border-radius:6px;color:#a1a1aa;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        CEO
                    </button>
                    <button class="share-role-btn" onclick="generateAndShare('manager')" style="padding:8px 14px;background:#1c1c20;border:1px solid #3f3f46;border-radius:6px;color:#a1a1aa;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        Manager
                    </button>
                    <button class="share-role-btn" onclick="generateAndShare('qa')" style="padding:8px 14px;background:#1c1c20;border:1px solid #3f3f46;border-radius:6px;color:#a1a1aa;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        QA Team
                    </button>
                </div>
            </div>

            <!-- Active links -->
            <?php if (!empty($links)): ?>
            <div style="margin-bottom:20px">
                <div style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Active Review Links</div>
                <?php foreach ($links as $link): ?>
                <?php if ($link['is_active']): ?>
                <div style="background:#09090b;border-radius:8px;padding:12px;margin-bottom:8px">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                        <div style="flex:1;min-width:0">
                            <div style="font-family:monospace;font-size:11px;color:#60a5fa;word-break:break-all;margin-bottom:4px">
                                <?= APP_URL ?>/release/review/<?= e($link['token']) ?>
                            </div>
                            <div style="font-size:11px;color:#71717a">
                                <span style="background:#1e3a5f;color:#93c5fd;padding:2px 6px;border-radius:4px;text-transform:uppercase;font-size:10px">
                                    <?= e(ucwords(str_replace('_',' ',$link['type']))) ?>
                                </span>
                                <?php if ($link['label']): ?>
                                <span style="color:#a1a1aa"> &middot; <?= e($link['label']) ?></span>
                                <?php endif; ?>
                                <?php if ($link['expires_at']): ?>
                                <span> &middot; Expires <?= date('M j, g:i A', strtotime($link['expires_at'])) ?></span>
                                <?php endif; ?>
                            </div>
                        </div>
                        <div style="display:flex;gap:6px;flex-shrink:0">
                            <button onclick="copyLink('<?= e($link['token']) ?>')" title="Copy link" style="padding:6px 10px;background:#1e3a5f;border:none;border-radius:6px;color:#93c5fd;font-size:12px;cursor:pointer">
                                Copy
                            </button>
                            <button onclick="deactivateLink(<?= $link['id'] ?>)" title="Revoke link" style="padding:6px 10px;background:#450a0a;border:none;border-radius:6px;color:#fca5a5;font-size:12px;cursor:pointer">
                                Revoke
                            </button>
                        </div>
                    </div>
                </div>
                <?php endif; ?>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>

            <!-- Generate new link -->
            <div style="border-top:1px solid #27272a;padding-top:16px">
                <div style="font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Create New Link</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
                    <div>
                        <label style="font-size:12px;color:#71717a;display:block;margin-bottom:4px">Type</label>
                        <select id="linkType" style="width:100%;background:#09090b;border:1px solid #27272a;color:#f4f4f5;padding:8px 10px;border-radius:6px;font-size:13px">
                            <option value="view_only">View Only</option>
                            <option value="internal_review">Internal Review (comment)</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-size:12px;color:#71717a;display:block;margin-bottom:4px">Expires</label>
                        <select id="linkExpiry" style="width:100%;background:#09090b;border:1px solid #27272a;color:#f4f4f5;padding:8px 10px;border-radius:6px;font-size:13px">
                            <option value="">Never</option>
                            <option value="24h">24 hours</option>
                            <option value="3d">3 days</option>
                            <option value="7d">7 days</option>
                        </select>
                    </div>
                </div>
                <div style="margin-bottom:10px">
                    <label style="font-size:12px;color:#71717a;display:block;margin-bottom:4px">Label (optional)</label>
                    <input type="text" id="linkLabel" placeholder="e.g. For CEO final review" style="width:100%;background:#09090b;border:1px solid #27272a;color:#f4f4f5;padding:8px 10px;border-radius:6px;font-size:13px">
                </div>
                <button onclick="createLink(<?= $release['id'] ?>)" class="rd-btn rd-btn--blue" style="width:100%;justify-content:center">
                    Generate Link
                </button>
            </div>

        </div>
        <div class="modal-footer" style="padding:16px 24px;border-top:1px solid #27272a;display:flex;justify-content:flex-end">
            <button onclick="closeShareLinkDialog()" class="rd-btn rd-btn--ghost" style="width:auto">Close</button>
        </div>
    </div>
</div>

<style>
.share-role-btn:hover{background:#27272a;border-color:#52525b;color:#f4f4f5}
</style>

<script>
const CSRF = '<?= e($csrf) ?>';
const BASE = '<?= e(APP_URL) ?>';

function openShareLinkDialog() {
    document.getElementById('shareLinkDialog').style.display = 'flex';
}
function closeShareLinkDialog() {
    document.getElementById('shareLinkDialog').style.display = 'none';
}
document.getElementById('shareLinkDialog').addEventListener('click', function(e) {
    if (e.target === this) closeShareLinkDialog();
});

function copyLink(token) {
    const url = BASE + '/release/review/' + token;
    navigator.clipboard.writeText(url).then(() => {
        showToast('Link copied to clipboard');
    }).catch(() => {
        prompt('Copy this link:', url);
    });
}

function generateAndShare(role) {
    // Pre-fill label and generate
    const labelMap = {ceo: 'For CEO review', manager: 'For Manager review', qa: 'For QA review'};
    document.getElementById('linkLabel').value = labelMap[role] || '';
    document.getElementById('linkExpiry').value = '7d';
    document.getElementById('linkType').value = role === 'qa' ? 'internal_review' : 'view_only';

    fetch(BASE + '/api/admin/releases/' + <?= $release['id'] ?> + '/link', {
        method: 'POST',
        headers: {'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},
        body: 'csrf_token=' + CSRF + '&type=' + (role === 'qa' ? 'internal_review' : 'view_only') + '&label=' + encodeURIComponent(labelMap[role] || '') + '&expiry=7d'
    }).then(r => r.json()).then(d => {
        if (d.success) {
            copyLink(d.token);
            closeShareLinkDialog();
            setTimeout(() => location.reload(), 800);
        } else {
            alert(d.error || 'Failed to generate link');
        }
    });
}

function showToast(msg) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#18181b;border:1px solid #27272a;color:#4ade80;padding:10px 20px;border-radius:8px;font-size:13px;z-index:9999;box-shadow:0 4px 12px #00000080';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}
</script>
