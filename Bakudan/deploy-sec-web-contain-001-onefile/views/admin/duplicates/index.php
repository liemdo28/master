<?php /** @var array $groups */ ?>
<div class="page-header" style="margin-bottom:24px;">
    <h1 style="color:#f1f5f9;font-size:22px;font-weight:700;margin:0;">Duplicate Management</h1>
    <p style="color:#94a3b8;margin:4px 0 0;">Pending duplicate groups detected by the daily scanner.</p>
</div>

<?php if (empty($groups)): ?>
    <div style="background:#1e2a3b;border-radius:12px;padding:48px;text-align:center;color:#94a3b8;">
        <div style="font-size:48px;margin-bottom:12px;">&#10003;</div>
        <div style="font-size:16px;font-weight:600;color:#e2e8f0;">No pending duplicates</div>
        <div style="margin-top:8px;font-size:14px;">The scanner has not detected any duplicate groups yet.</div>
    </div>
<?php else: ?>
    <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;background:#1e2a3b;border-radius:12px;overflow:hidden;">
            <thead>
                <tr style="background:#0f172a;">
                    <th style="padding:12px 16px;text-align:left;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;">Type</th>
                    <th style="padding:12px 16px;text-align:left;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;">Original</th>
                    <th style="padding:12px 16px;text-align:left;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;">Duplicate(s)</th>
                    <th style="padding:12px 16px;text-align:left;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;">Detected</th>
                    <th style="padding:12px 16px;text-align:left;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;">Actions</th>
                </tr>
            </thead>
            <tbody>
            <?php foreach ($groups as $group): ?>
                <?php
                    $canonical = null;
                    $dupes     = [];
                    foreach ($group['items'] as $item) {
                        if ($item['is_canonical']) $canonical = $item;
                        else $dupes[] = $item;
                    }
                    $canonicalRec = $canonical ? $canonical['record'] : null;
                ?>
                <tr style="border-top:1px solid #334155;" data-group-id="<?= (int)$group['id'] ?>">
                    <td style="padding:12px 16px;">
                        <span style="background:<?= $group['entity_type']==='bill' ? '#1e3a5f' : '#1a3a2a' ?>;color:<?= $group['entity_type']==='bill' ? '#60a5fa' : '#4ade80' ?>;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">
                            <?= strtoupper(e($group['entity_type'])) ?>
                        </span>
                    </td>
                    <td style="padding:12px 16px;">
                        <?php if ($canonicalRec): ?>
                            <div style="color:#f1f5f9;font-weight:600;font-size:14px;"><?= e($canonicalRec['title'] ?? '???') ?></div>
                            <div style="color:#94a3b8;font-size:12px;margin-top:2px;">
                                <?= e($canonicalRec['store_name'] ?? '') ?>
                                <?php if (!empty($canonicalRec['due_date'])): ?> &middot; <?= e(substr($canonicalRec['due_date'], 0, 10)) ?><?php endif; ?>
                                <?php if (!empty($canonicalRec['amount'])): ?> &middot; $<?= number_format((float)$canonicalRec['amount'], 2) ?><?php endif; ?>
                            </div>
                            <div style="margin-top:4px;">
                                <span style="background:#374151;color:#d1d5db;padding:1px 6px;border-radius:3px;font-size:11px;"><?= e($canonicalRec['status'] ?? '') ?></span>
                            </div>
                        <?php else: ?>
                            <span style="color:#94a3b8;font-size:13px;">ID: <?= (int)($canonical['entity_id'] ?? 0) ?></span>
                        <?php endif; ?>
                    </td>
                    <td style="padding:12px 16px;">
                        <?php foreach ($dupes as $dup): ?>
                            <?php $rec = $dup['record'] ?? null; ?>
                            <div style="margin-bottom:6px;padding:6px 10px;background:#0f172a;border-radius:6px;">
                                <?php if ($rec): ?>
                                    <div style="color:#fbbf24;font-size:13px;font-weight:600;"><?= e($rec['title'] ?? '???') ?></div>
                                    <div style="color:#94a3b8;font-size:11px;">
                                        <?= e($rec['store_name'] ?? '') ?>
                                        <?php if (!empty($rec['due_date'])): ?> &middot; <?= e(substr($rec['due_date'], 0, 10)) ?><?php endif; ?>
                                    </div>
                                    <div style="margin-top:3px;">
                                        <?php if ($group['entity_type'] === 'bill'): ?>
                                            <a href="<?= APP_URL ?>/bills/store/<?= (int)($rec['store_id'] ?? 0) ?>" style="color:#60a5fa;font-size:11px;text-decoration:none;">Open</a>
                                        <?php else: ?>
                                            <a href="<?= APP_URL ?>/tasks/<?= (int)$rec['id'] ?>" style="color:#60a5fa;font-size:11px;text-decoration:none;">Open</a>
                                        <?php endif; ?>
                                    </div>
                                <?php else: ?>
                                    <span style="color:#94a3b8;font-size:12px;">ID: <?= (int)$dup['entity_id'] ?></span>
                                <?php endif; ?>
                            </div>
                        <?php endforeach; ?>
                    </td>
                    <td style="padding:12px 16px;color:#94a3b8;font-size:13px;">
                        <?= e(substr($group['detected_at'] ?? '', 0, 16)) ?>
                    </td>
                    <td style="padding:12px 16px;">
                        <div style="display:flex;gap:6px;flex-wrap:wrap;">
                            <button onclick="dupAction(<?= (int)$group['id'] ?>, 'archive')"
                                    style="background:#dc2626;color:#fff;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;font-size:12px;">
                                Archive Dup
                            </button>
                            <button onclick="dupAction(<?= (int)$group['id'] ?>, 'ignore')"
                                    style="background:#374151;color:#d1d5db;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;font-size:12px;">
                                Ignore
                            </button>
                            <button onclick="dupAction(<?= (int)$group['id'] ?>, 'not-duplicate')"
                                    style="background:#1e3a5f;color:#60a5fa;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;font-size:12px;">
                                Not Duplicate
                            </button>
                        </div>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
<?php endif; ?>

<script>
function dupAction(groupId, action) {
    if (!confirm('Confirm: ' + action + ' group #' + groupId + '?')) return;
    fetch('<?= APP_URL ?>/admin/duplicates/' + groupId + '/' + action, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'csrf=<?= csrf_token() ?>'
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.ok) {
            var row = document.querySelector('tr[data-group-id="' + groupId + '"]');
            if (row) row.style.display = 'none';
        } else {
            alert('Error: ' + (data.error || 'Unknown'));
        }
    });
}
</script>
