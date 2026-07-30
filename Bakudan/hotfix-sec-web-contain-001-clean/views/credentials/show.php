<?php
$pageTitle   = $pageTitle   ?? ($credential['service_name'] . ' — Credential');
$currentPage = $currentPage ?? 'credentials';
$user        = currentUser();
$isAdmin     = canAdmin();
$canEdit     = $isAdmin || ($userPerm && $userPerm['can_edit']);
$canViewPwd  = $isAdmin || ($userPerm && $userPerm['can_view_password']);
$canRotate   = $isAdmin || ($userPerm && $userPerm['can_rotate_password']);

ob_start();
?>
<style>
.cred-detail-grid{display:grid;grid-template-columns:1fr 360px;gap:20px;align-items:start}
@media(max-width:900px){.cred-detail-grid{grid-template-columns:1fr}}

.cd-section{background:#18181b;border:1px solid #27272a;border-radius:12px;margin-bottom:16px;overflow:hidden}
.cd-section-header{padding:14px 18px;border-bottom:1px solid #27272a;display:flex;align-items:center;justify-content:space-between}
.cd-section-title{font-size:13px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:.06em;display:flex;align-items:center;gap:8px}
.cd-section-body{padding:18px}

.cd-row{display:flex;align-items:flex-start;padding:10px 0;border-bottom:1px solid #27272a}
.cd-row:last-child{border-bottom:none}
.cd-label{width:180px;flex-shrink:0;font-size:12px;font-weight:600;color:#71717a;padding-top:1px}
.cd-value{flex:1;font-size:13px;color:#e4e4e7;word-break:break-all}
.cd-value a{color:#60a5fa;text-decoration:none}
.cd-value a:hover{text-decoration:underline}

.pwd-field{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.pwd-masked{font-size:18px;letter-spacing:3px;color:#52525b;font-family:monospace}
.pwd-revealed{font-family:monospace;font-size:14px;color:#4ade80;background:#052e16;padding:8px 12px;border-radius:8px;border:1px solid rgba(74,222,128,.2);word-break:break-all}
.pwd-timer{font-size:11px;color:#f87171;font-weight:600}
.pwd-warning{background:#1c1917;border:1px solid rgba(251,191,36,.3);color:#fbbf24;font-size:12px;padding:8px 12px;border-radius:8px;margin-top:8px;display:none}

.btn-sm{padding:6px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid transparent;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
.btn-sm-ghost{background:transparent;border-color:#27272a;color:#a1a1aa}
.btn-sm-ghost:hover{background:#27272a;color:#f4f4f5}
.btn-sm-primary{background:#1d4ed8;border-color:#2563eb;color:#fff}
.btn-sm-primary:hover{background:#2563eb}
.btn-sm-danger{background:rgba(220,38,38,.1);border-color:rgba(220,38,38,.35);color:#f87171}
.btn-sm-danger:hover{background:rgba(220,38,38,.2)}
.btn-sm-success{background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.35);color:#4ade80}
.btn-sm-success:hover{background:rgba(34,197,94,.2)}

.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600}
.badge-active{background:rgba(74,222,128,.1);color:#4ade80;border:1px solid rgba(74,222,128,.25)}
.badge-inactive{background:rgba(113,113,122,.1);color:#71717a;border:1px solid #27272a}
.badge-compromised{background:rgba(248,113,113,.15);color:#f87171;border:1px solid rgba(248,113,113,.3)}
.badge-danger{background:rgba(248,113,113,.15);color:#f87171;border:1px solid rgba(248,113,113,.3)}
.badge-warning{background:rgba(251,191,36,.12);color:#fbbf24;border:1px solid rgba(251,191,36,.3)}
.badge-success{background:rgba(74,222,128,.12);color:#4ade80;border:1px solid rgba(74,222,128,.3)}
.badge-neutral{background:rgba(113,113,122,.1);color:#71717a;border:1px solid #27272a}

.permission-table{width:100%;border-collapse:collapse;font-size:12px}
.permission-table th{color:#71717a;font-weight:600;padding:6px 10px;text-align:left;border-bottom:1px solid #27272a}
.permission-table td{padding:8px 10px;border-bottom:1px solid #1c1c1f;color:#d4d4d8}
.permission-table tr:last-child td{border-bottom:none}
.perm-check{color:#4ade80}
.perm-no{color:#52525b}

.audit-entry{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #27272a}
.audit-entry:last-child{border-bottom:none}
.audit-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;background:#27272a}
.audit-body{flex:1;min-width:0}
.audit-action{font-size:12px;font-weight:600;color:#e4e4e7}
.audit-meta{font-size:11px;color:#52525b;margin-top:2px}

.grant-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.perm-checkbox{display:flex;align-items:center;gap:8px;font-size:12px;color:#d4d4d8;padding:4px 0}
.perm-checkbox input[type=checkbox]{accent-color:#3b82f6}

.rotation-info{display:flex;flex-direction:column;gap:8px}
.rotation-bar{background:#27272a;border-radius:6px;height:6px;overflow:hidden;margin-top:4px}
.rotation-fill{height:100%;border-radius:6px}
</style>

<?php if ($msg = flash('success')): ?><div class="alert alert-success"><?= e($msg) ?></div><?php endif; ?>
<?php if ($msg = flash('error')): ?><div class="alert alert-error"><?= e($msg) ?></div><?php endif; ?>

<!-- Breadcrumb + actions -->
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px">
    <div style="font-size:13px;color:#71717a">
        <a href="<?= APP_URL ?>/security/credentials" style="color:#60a5fa;text-decoration:none">Credential Vault</a>
        <span style="margin:0 6px">›</span>
        <span style="color:#e4e4e7"><?= e($credential['service_name']) ?></span>
    </div>
    <div style="display:flex;gap:8px">
        <?php if ($canEdit): ?>
        <a href="<?= APP_URL ?>/security/credentials/<?= $credential['id'] ?>/edit" class="btn-sm btn-sm-ghost">✏️ Edit</a>
        <?php endif; ?>
        <?php if ($canRotate || $isAdmin): ?>
        <form method="POST" action="<?= APP_URL ?>/security/credentials/<?= $credential['id'] ?>/create-rotation-task" style="display:inline">
            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
            <button type="submit" class="btn-sm btn-sm-success" onclick="return confirm('Create a password rotation task for this credential?')">🔄 Create Rotation Task</button>
        </form>
        <?php endif; ?>
        <?php if ($isAdmin): ?>
        <form method="POST" action="<?= APP_URL ?>/security/credentials/<?= $credential['id'] ?>/delete" style="display:inline">
            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
            <button type="submit" class="btn-sm btn-sm-danger" onclick="return confirm('Permanently delete this credential? This action is logged and cannot be undone.')">🗑 Delete</button>
        </form>
        <?php endif; ?>
    </div>
</div>

<div class="cred-detail-grid">
<!-- LEFT COLUMN -->
<div>
    <!-- Login Info -->
    <div class="cd-section">
        <div class="cd-section-header">
            <div class="cd-section-title">🔑 Login Information</div>
            <?php
            $statusClass = match($credential['status'] ?? 'active') {
                'active'     => 'badge-active',
                'inactive'   => 'badge-inactive',
                'compromised'=> 'badge-compromised',
                default      => 'badge-neutral',
            };
            ?>
            <span class="badge <?= $statusClass ?>"><?= ucfirst($credential['status'] ?? 'active') ?></span>
        </div>
        <div class="cd-section-body" style="padding:0">
            <div style="padding:0 18px">
            <?php if ($credential['service_name']): ?>
            <div class="cd-row"><div class="cd-label">Service</div><div class="cd-value" style="font-weight:700;font-size:16px;color:#f4f4f5"><?= e($credential['service_name']) ?></div></div>
            <?php endif; ?>
            <?php
            $_ct = $credential['credential_type'] ?? 'login';
            $_ctLabel = ['login'=>'🔑 Login / Password','card'=>'💳 Card','identity'=>'🪪 ID Document','link'=>'🔗 Link'][$_ct] ?? '🔑 Login';
            ?>
            <div class="cd-row"><div class="cd-label">Type</div><div class="cd-value"><?= $_ctLabel ?></div></div>
            <?php if ($credential['website']): ?>
            <div class="cd-row"><div class="cd-label">Website</div><div class="cd-value"><a href="<?= e($credential['website']) ?>" target="_blank" rel="noopener"><?= e($credential['website']) ?> ↗</a></div></div>
            <?php endif; ?>
            <?php if ($credential['login_url']): ?>
            <div class="cd-row"><div class="cd-label">Login URL</div><div class="cd-value"><a href="<?= e($credential['login_url']) ?>" target="_blank" rel="noopener"><?= e($credential['login_url']) ?> ↗</a></div></div>
            <?php endif; ?>
            <?php if ($credential['username']): ?>
            <div class="cd-row">
                <div class="cd-label">Username</div>
                <div class="cd-value">
                    <div style="display:flex;align-items:center;gap:8px">
                        <span style="font-family:monospace;font-size:14px"><?= e($credential['username']) ?></span>
                        <button class="btn-sm btn-sm-ghost" style="padding:2px 8px;font-size:11px" onclick="copyText('<?= e($credential['username']) ?>', this)">Copy</button>
                    </div>
                </div>
            </div>
            <?php endif; ?>
            <?php if ($credential['email']): ?>
            <div class="cd-row">
                <div class="cd-label">Email</div>
                <div class="cd-value">
                    <div style="display:flex;align-items:center;gap:8px">
                        <span style="font-family:monospace;font-size:14px"><?= e($credential['email']) ?></span>
                        <button class="btn-sm btn-sm-ghost" style="padding:2px 8px;font-size:11px" onclick="copyText('<?= e($credential['email']) ?>', this)">Copy</button>
                    </div>
                </div>
            </div>
            <?php endif; ?>
            <?php if ($credential['owner_name']): ?>
            <div class="cd-row"><div class="cd-label">Owner</div><div class="cd-value"><?= e($credential['owner_name']) ?></div></div>
            <?php endif; ?>
            <?php if ($credential['store_name']): ?>
            <div class="cd-row"><div class="cd-label">Store</div><div class="cd-value"><?= e($credential['store_name']) ?></div></div>
            <?php endif; ?>
            <?php if ($credential['department']): ?>
            <div class="cd-row"><div class="cd-label">Department</div><div class="cd-value"><?= e($credential['department']) ?></div></div>
            <?php endif; ?>
            <?php if ($credential['notes']): ?>
            <div class="cd-row"><div class="cd-label">Notes</div><div class="cd-value" style="color:#a1a1aa;white-space:pre-wrap"><?= e($credential['notes']) ?></div></div>
            <?php endif; ?>
            </div>
        </div>
    </div>

    <!-- Password Section -->
    <div class="cd-section">
        <div class="cd-section-header">
            <div class="cd-section-title">🔒 Password</div>
        </div>
        <div class="cd-section-body">
            <?php if ($credential['encrypted_password']): ?>
            <div class="pwd-warning" id="pwdWarning">⚠️ Viewing passwords is logged and audited. This record will be stored permanently.</div>
            <div class="pwd-field">
                <div id="pwdDisplay">
                    <span class="pwd-masked" id="pwdMasked">••••••••••••</span>
                    <div class="pwd-revealed" id="pwdRevealed" style="display:none"></div>
                </div>
                <?php if ($canViewPwd): ?>
                <button class="btn-sm btn-sm-primary" id="btnViewPwd" onclick="viewPassword(<?= $credential['id'] ?>)">👁 View Password</button>
                <button class="btn-sm btn-sm-ghost" id="btnCopyPwd" style="display:none" onclick="copyPassword()">📋 Copy</button>
                <button class="btn-sm btn-sm-ghost" id="btnHidePwd" style="display:none" onclick="hidePassword()">Hide</button>
                <?php else: ?>
                <span style="font-size:12px;color:#52525b">You don't have permission to view this password.</span>
                <?php endif; ?>
            </div>
            <div id="pwdTimer" style="margin-top:8px;display:none"></div>
            <?php else: ?>
            <span style="color:#52525b;font-size:13px">No password stored</span>
            <?php endif; ?>
        </div>
    </div>

    <!-- Change Instructions -->
    <?php if ($credential['password_change_instructions']): ?>
    <div class="cd-section">
        <div class="cd-section-header">
            <div class="cd-section-title">📋 How to Change Password</div>
        </div>
        <div class="cd-section-body">
            <div style="font-size:13px;color:#d4d4d8;white-space:pre-wrap;line-height:1.7"><?= e($credential['password_change_instructions']) ?></div>
        </div>
    </div>
    <?php endif; ?>

    <!-- Related Rotation Task -->
    <?php if ($rotationTask): ?>
    <div class="cd-section">
        <div class="cd-section-header">
            <div class="cd-section-title">🔄 Active Rotation Task</div>
        </div>
        <div class="cd-section-body">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
                <div>
                    <div style="font-size:13px;font-weight:600;color:#e4e4e7"><?= e($rotationTask['task_title'] ?? 'Rotation Task') ?></div>
                    <div style="font-size:11px;color:#52525b;margin-top:3px">
                        Due: <?= date('M j, Y', strtotime($rotationTask['due_at'])) ?>
                        · Status: <span style="color:#fbbf24"><?= e($rotationTask['status']) ?></span>
                    </div>
                </div>
                <?php if ($rotationTask['task_id']): ?>
                <a href="<?= APP_URL ?>/tasks/<?= $rotationTask['task_id'] ?>" class="btn-sm btn-sm-ghost">View Task →</a>
                <?php endif; ?>
            </div>
        </div>
    </div>
    <?php endif; ?>

    <!-- Audit History -->
    <div class="cd-section">
        <div class="cd-section-header">
            <div class="cd-section-title">📜 Recent Audit History</div>
            <?php if ($isAdmin): ?>
            <a href="<?= APP_URL ?>/security/audit-logs" style="font-size:11px;color:#60a5fa;text-decoration:none">View All →</a>
            <?php endif; ?>
        </div>
        <div class="cd-section-body" style="padding:6px 18px">
            <?php if (empty($auditLogs)): ?>
            <div style="color:#52525b;font-size:13px;padding:12px 0">No audit events yet</div>
            <?php else: ?>
            <?php foreach ($auditLogs as $log):
                $actionLabels = [
                    'credential_created'  => ['icon' => '✅', 'label' => 'Created'],
                    'credential_updated'  => ['icon' => '✏️', 'label' => 'Updated'],
                    'password_viewed'     => ['icon' => '👁', 'label' => 'Password Viewed'],
                    'password_copied'     => ['icon' => '📋', 'label' => 'Password Copied'],
                    'password_changed'    => ['icon' => '🔑', 'label' => 'Password Changed'],
                    'access_granted'      => ['icon' => '🔓', 'label' => 'Access Granted'],
                    'access_revoked'      => ['icon' => '🔒', 'label' => 'Access Revoked'],
                    'credential_deleted'  => ['icon' => '🗑', 'label' => 'Deleted'],
                    'rotation_task_created'=>['icon'=>'🔄','label'=>'Rotation Task Created'],
                    'rotation_completed'  => ['icon' => '✅', 'label' => 'Rotation Completed'],
                ];
                $al = $actionLabels[$log['action']] ?? ['icon' => '●', 'label' => $log['action']];
            ?>
            <div class="audit-entry">
                <div class="audit-icon"><?= $al['icon'] ?></div>
                <div class="audit-body">
                    <div class="audit-action">
                        <?= $al['label'] ?>
                        <?php if (!$log['success']): ?><span style="color:#f87171;font-size:11px"> · FAILED</span><?php endif; ?>
                    </div>
                    <div class="audit-meta">
                        by <?= e($log['actor_name'] ?? 'Unknown') ?>
                        · <?= date('M j, Y g:ia', strtotime($log['created_at'])) ?>
                        <?php if ($log['ip_address']): ?> · <?= e($log['ip_address']) ?><?php endif; ?>
                    </div>
                </div>
            </div>
            <?php endforeach; ?>
            <?php endif; ?>
        </div>
    </div>
</div>

<!-- RIGHT COLUMN -->
<div>
    <!-- Rotation Schedule -->
    <div class="cd-section">
        <div class="cd-section-header">
            <div class="cd-section-title">🗓 Rotation Schedule</div>
        </div>
        <div class="cd-section-body">
            <?php
            $freq = $credential['rotation_frequency_days'];
            $lastChanged = $credential['last_changed_at'];
            $nextDue = $credential['next_rotation_due_at'];
            $daysUntilDue = $nextDue ? (int)floor((strtotime($nextDue) - time()) / 86400) : null;
            ?>
            <div class="rotation-info">
                <div class="cd-row" style="padding:6px 0;border-bottom:1px solid #27272a">
                    <div class="cd-label" style="width:130px">Frequency</div>
                    <div class="cd-value"><?= $freq ? $freq . ' days' : '<span style="color:#52525b">Not set</span>' ?></div>
                </div>
                <div class="cd-row" style="padding:6px 0;border-bottom:1px solid #27272a">
                    <div class="cd-label" style="width:130px">Last Changed</div>
                    <div class="cd-value"><?= $lastChanged ? date('M j, Y', strtotime($lastChanged)) : '<span style="color:#52525b">Unknown</span>' ?></div>
                </div>
                <div class="cd-row" style="padding:6px 0;border-bottom:none">
                    <div class="cd-label" style="width:130px">Next Due</div>
                    <div class="cd-value">
                        <?php if ($nextDue): ?>
                        <?= date('M j, Y', strtotime($nextDue)) ?>
                        <?php if ($daysUntilDue < 0): ?>
                        <div style="color:#f87171;font-size:11px;margin-top:3px">⚠️ <?= abs($daysUntilDue) ?> days overdue</div>
                        <?php elseif ($daysUntilDue <= 7): ?>
                        <div style="color:#fbbf24;font-size:11px;margin-top:3px">⏰ Due in <?= $daysUntilDue ?> days</div>
                        <?php else: ?>
                        <div style="color:#4ade80;font-size:11px;margin-top:3px">✅ <?= $daysUntilDue ?> days remaining</div>
                        <?php endif; ?>
                        <?php if ($freq && $lastChanged): ?>
                        <div class="rotation-bar" style="margin-top:8px">
                            <?php
                            $total = $freq * 86400;
                            $elapsed = time() - strtotime($lastChanged);
                            $pct = min(100, max(0, round($elapsed / $total * 100)));
                            $color = $pct >= 100 ? '#f87171' : ($pct >= 85 ? '#fbbf24' : '#4ade80');
                            ?>
                            <div class="rotation-fill" style="width:<?= $pct ?>%;background:<?= $color ?>"></div>
                        </div>
                        <div style="font-size:11px;color:#52525b;margin-top:4px"><?= $pct ?>% of rotation period elapsed</div>
                        <?php endif; ?>
                        <?php else: ?>
                        <span style="color:#52525b">—</span>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Access Control (Admin Only) -->
    <?php if ($isAdmin): ?>
    <div class="cd-section">
        <div class="cd-section-header">
            <div class="cd-section-title">🛡 Access Control</div>
        </div>
        <div class="cd-section-body">
            <!-- Grant Access Form -->
            <details style="margin-bottom:16px">
                <summary style="cursor:pointer;font-size:12px;color:#60a5fa;font-weight:600">+ Grant Access to User</summary>
                <form method="POST" action="<?= APP_URL ?>/security/credentials/<?= $credential['id'] ?>/grant-access" style="margin-top:12px">
                    <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
                    <select name="user_id" style="width:100%;background:#27272a;border:1px solid #3f3f46;color:#e4e4e7;padding:8px 10px;border-radius:8px;font-size:13px;margin-bottom:10px">
                        <option value="">Select user…</option>
                        <?php foreach ($users as $u): ?>
                        <option value="<?= $u['id'] ?>">[<?= ucfirst($u['role']) ?>] <?= e($u['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                    <div class="grant-form-grid">
                        <label class="perm-checkbox"><input type="checkbox" name="can_view_metadata" value="1"> View Metadata</label>
                        <label class="perm-checkbox"><input type="checkbox" name="can_view_password" value="1"> View Password</label>
                        <label class="perm-checkbox"><input type="checkbox" name="can_edit" value="1"> Edit</label>
                        <label class="perm-checkbox"><input type="checkbox" name="can_rotate_password" value="1"> Rotate Password</label>
                        <label class="perm-checkbox"><input type="checkbox" name="can_grant_access" value="1"> Grant Access</label>
                        <label class="perm-checkbox"><input type="checkbox" name="can_delete" value="1"> Delete</label>
                    </div>
                    <button type="submit" class="btn-sm btn-sm-primary" style="margin-top:10px;width:100%">Grant Access</button>
                </form>
            </details>

            <!-- Current Access List -->
            <?php if (empty($permissions)): ?>
            <div style="font-size:12px;color:#52525b">No user-level permissions set (CEO/Admin have full access by default)</div>
            <?php else: ?>
            <table class="permission-table">
                <thead>
                    <tr>
                        <th>User</th>
                        <th title="View Metadata">Meta</th>
                        <th title="View Password">Pwd</th>
                        <th title="Edit">Edit</th>
                        <th title="Rotate">Rot</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                <?php foreach ($permissions as $perm): ?>
                <?php if ($perm['revoked_at']) continue; ?>
                <tr>
                    <td>
                        <div style="font-weight:600"><?= e($perm['user_name'] ?? '?') ?></div>
                        <div style="font-size:10px;color:#52525b"><?= ucfirst($perm['user_role'] ?? '') ?></div>
                    </td>
                    <td><?= $perm['can_view_metadata'] ? '<span class="perm-check">✓</span>' : '<span class="perm-no">—</span>' ?></td>
                    <td><?= $perm['can_view_password'] ? '<span class="perm-check">✓</span>' : '<span class="perm-no">—</span>' ?></td>
                    <td><?= $perm['can_edit'] ? '<span class="perm-check">✓</span>' : '<span class="perm-no">—</span>' ?></td>
                    <td><?= $perm['can_rotate_password'] ? '<span class="perm-check">✓</span>' : '<span class="perm-no">—</span>' ?></td>
                    <td>
                        <form method="POST" action="<?= APP_URL ?>/security/credentials/<?= $credential['id'] ?>/revoke-access" style="display:inline">
                            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
                            <input type="hidden" name="user_id" value="<?= $perm['user_id'] ?>">
                            <button type="submit" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:11px" onclick="return confirm('Revoke access for <?= e($perm['user_name'] ?? '') ?>?')">Revoke</button>
                        </form>
                    </td>
                </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
            <?php endif; ?>
        </div>
    </div>
    <?php endif; ?>

    <!-- Metadata -->
    <div class="cd-section">
        <div class="cd-section-header">
            <div class="cd-section-title">ℹ️ Record Info</div>
        </div>
        <div class="cd-section-body" style="padding:0">
            <div style="padding:0 18px">
            <div class="cd-row" style="padding:8px 0">
                <div class="cd-label" style="width:130px;font-size:11px">Created</div>
                <div class="cd-value" style="font-size:12px;color:#71717a"><?= $credential['created_at'] ? date('M j, Y g:ia', strtotime($credential['created_at'])) : '—' ?></div>
            </div>
            <div class="cd-row" style="padding:8px 0;border-bottom:none">
                <div class="cd-label" style="width:130px;font-size:11px">Updated</div>
                <div class="cd-value" style="font-size:12px;color:#71717a"><?= $credential['updated_at'] ? date('M j, Y g:ia', strtotime($credential['updated_at'])) : '—' ?></div>
            </div>
            </div>
        </div>
    </div>
</div>
</div><!-- /cred-detail-grid -->

<script>
var _pwdHideTimer = null;
var _currentPwd = '';

function viewPassword(credId) {
    var btn = document.getElementById('btnViewPwd');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
    document.getElementById('pwdWarning').style.display = 'block';

    fetch('<?= APP_URL ?>/security/credentials/' + credId + '/view-password', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'},
        body: JSON.stringify({csrf: '<?= csrf_token() ?>'})
    })
    .then(function(r){ return r.json(); })
    .then(function(d) {
        if (d.success) {
            _currentPwd = d.password;
            document.getElementById('pwdMasked').style.display = 'none';
            var revealed = document.getElementById('pwdRevealed');
            revealed.textContent = d.password;
            revealed.style.display = 'block';
            if (btn) btn.style.display = 'none';
            var copyBtn = document.getElementById('btnCopyPwd');
            var hideBtn = document.getElementById('btnHidePwd');
            if (copyBtn) copyBtn.style.display = '';
            if (hideBtn) hideBtn.style.display = '';
            startHideTimer(30);
        } else {
            alert('Error: ' + (d.error || 'Failed to retrieve password'));
            if (btn) { btn.disabled = false; btn.textContent = '👁 View Password'; }
        }
    })
    .catch(function(){
        alert('Network error. Please try again.');
        if (btn) { btn.disabled = false; btn.textContent = '👁 View Password'; }
    });
}

function startHideTimer(secs) {
    var timerEl = document.getElementById('pwdTimer');
    timerEl.style.display = '';
    var remaining = secs;
    function tick() {
        timerEl.innerHTML = '<span class="pwd-timer">Password auto-hides in ' + remaining + 's</span>';
        if (remaining <= 0) { hidePassword(); return; }
        remaining--;
        _pwdHideTimer = setTimeout(tick, 1000);
    }
    tick();
}

function hidePassword() {
    if (_pwdHideTimer) clearTimeout(_pwdHideTimer);
    _currentPwd = '';
    document.getElementById('pwdMasked').style.display = '';
    var revealed = document.getElementById('pwdRevealed');
    if (revealed) { revealed.textContent = ''; revealed.style.display = 'none'; }
    var btn = document.getElementById('btnViewPwd');
    if (btn) { btn.disabled = false; btn.textContent = '👁 View Password'; btn.style.display = ''; }
    var copyBtn = document.getElementById('btnCopyPwd');
    var hideBtn = document.getElementById('btnHidePwd');
    if (copyBtn) copyBtn.style.display = 'none';
    if (hideBtn) hideBtn.style.display = 'none';
    document.getElementById('pwdTimer').style.display = 'none';
    document.getElementById('pwdWarning').style.display = 'none';
}

function copyPassword() {
    if (!_currentPwd) return;
    navigator.clipboard.writeText(_currentPwd).then(function() {
        // Log copy action
        fetch('<?= APP_URL ?>/security/credentials/<?= $credential['id'] ?>/copy-password', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'},
            body: JSON.stringify({csrf: '<?= csrf_token() ?>'})
        });
        var copyBtn = document.getElementById('btnCopyPwd');
        if (copyBtn) { var orig = copyBtn.textContent; copyBtn.textContent = '✓ Copied!'; setTimeout(function(){ copyBtn.textContent = orig; }, 1500); }
    });
}

function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(function() {
        var orig = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(function(){ btn.textContent = orig; }, 1500);
    });
}
</script>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
