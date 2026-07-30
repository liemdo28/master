<?php
$pageTitle = 'Admin Users';
$currentPage = 'admin-users';
$csrf = csrf_token();
$roleLabels = ['ceo' => 'CEO', 'admin' => 'Admin', 'manager' => 'Manager', 'staff' => 'Staff', 'member' => 'Staff'];
ob_start();
?>
<style>
.admin-users-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
.admin-users-head h2{margin:0;font-size:24px}
.admin-users-table-wrap{overflow:auto;border:1px solid var(--border);border-radius:12px;background:var(--bg-secondary)}
.admin-users-table{width:100%;border-collapse:collapse;min-width:860px}
.admin-users-table th,.admin-users-table td{padding:12px 14px;border-bottom:1px solid var(--border);text-align:left;vertical-align:middle}
.admin-users-table th{font-size:11px;text-transform:uppercase;color:var(--text-muted);letter-spacing:.06em;background:rgba(255,255,255,.03)}
.admin-users-table tr:last-child td{border-bottom:0}
.admin-user-main{display:flex;align-items:center;gap:10px}
.admin-user-avatar{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#dc2626;color:#fff;font-weight:700;font-size:12px;flex:0 0 auto}
.admin-user-name{font-weight:700}
.admin-user-email{font-size:12px;color:var(--text-muted);margin-top:2px}
.admin-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.admin-empty{padding:44px 16px;text-align:center;color:var(--text-muted)}
.admin-empty h3{margin:0 0 8px;color:var(--text-primary)}
.inline-form{display:inline}
.btn-danger-soft{color:#fca5a5;border-color:rgba(248,113,113,.35)}
.reset-row{display:flex;gap:6px;align-items:center}
.reset-row input{width:142px;min-width:142px}
.confirm-backdrop{display:none;position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.62);align-items:center;justify-content:center;padding:18px}
.confirm-modal{width:min(420px,100%);border:1px solid var(--border);border-radius:12px;background:var(--bg-primary);box-shadow:0 24px 70px rgba(0,0,0,.45);padding:20px}
.confirm-modal h3{margin:0 0 8px;font-size:18px}
.confirm-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}
@media (max-width: 760px){
  .admin-users-head{align-items:stretch;flex-direction:column}
  .admin-users-head .btn{width:100%;justify-content:center}
  .admin-users-table-wrap{border-radius:8px}
  .confirm-actions{flex-direction:column-reverse}
}
</style>

<div class="admin-users-head">
    <div>
        <h2>User Management</h2>
        <div class="text-muted text-sm">Admin-only account creation, edits, deactivation, and password resets.</div>
    </div>
    <a href="<?= APP_URL ?>/admin/users/create" class="btn btn-primary">Add User</a>
</div>

<div class="admin-users-table-wrap">
    <?php if (empty($users)): ?>
        <div class="admin-empty">
            <h3>No users yet</h3>
            <p>Create the first team account to start assigning work.</p>
            <a href="<?= APP_URL ?>/admin/users/create" class="btn btn-primary">Add User</a>
        </div>
    <?php else: ?>
    <table class="admin-users-table">
        <thead>
            <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Store</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($users as $u): ?>
            <?php
            $isSelf = (int)$u['id'] === (int)$_SESSION['user_id'];
            $isActive = (int)($u['is_active'] ?? 0) === 1;
            ?>
            <tr>
                <td>
                    <div class="admin-user-main">
                        <div class="admin-user-avatar"><?= e(strtoupper(substr($u['name'] ?? '?', 0, 1))) ?></div>
                        <div>
                            <div class="admin-user-name"><?= e($u['name']) ?><?= $isSelf ? ' <span class="text-muted text-sm">(you)</span>' : '' ?></div>
                            <div class="admin-user-email"><?= e($u['email']) ?></div>
                        </div>
                    </div>
                </td>
                <td><span class="badge badge-<?= e($u['role']) ?>"><?= e($roleLabels[$u['role']] ?? ucfirst($u['role'])) ?></span></td>
                <td><?= !empty($u['store_name']) ? e($u['store_name']) : '<span class="text-muted">All stores</span>' ?></td>
                <td><span class="badge badge-<?= $isActive ? 'active' : 'inactive' ?>"><?= $isActive ? 'Active' : 'Inactive' ?></span></td>
                <td><?= !empty($u['last_login_at']) ? e(date('M j, Y g:i A', strtotime($u['last_login_at']))) : '<span class="text-muted">Never</span>' ?></td>
                <td>
                    <div class="admin-actions">
                        <a href="<?= APP_URL ?>/admin/users/<?= (int)$u['id'] ?>/edit" class="btn btn-sm btn-outline">Edit</a>
                        <form method="POST" action="<?= APP_URL ?>/admin/users/<?= (int)$u['id'] ?>/reset-password" class="inline-form reset-row">
                            <input type="hidden" name="csrf_token" value="<?= e($csrf) ?>">
                            <input type="password" name="password" class="form-control" placeholder="New password" minlength="6" required>
                            <button type="submit" class="btn btn-sm btn-outline">Reset Password</button>
                        </form>
                        <?php if (!$isSelf && $isActive): ?>
                        <form method="POST" action="<?= APP_URL ?>/admin/users/<?= (int)$u['id'] ?>/deactivate" class="inline-form js-deactivate-form" data-user-name="<?= e($u['name']) ?>">
                            <input type="hidden" name="csrf_token" value="<?= e($csrf) ?>">
                            <button type="button" class="btn btn-sm btn-outline btn-danger-soft js-open-deactivate">Deactivate</button>
                        </form>
                        <?php endif; ?>
                    </div>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php endif; ?>
</div>

<div class="confirm-backdrop" id="deactivateConfirm" role="dialog" aria-modal="true" aria-labelledby="deactivateTitle">
    <div class="confirm-modal">
        <h3 id="deactivateTitle">Deactivate User</h3>
        <p class="text-muted" id="deactivateText" style="margin:0">This user will no longer be able to log in. Task history remains available.</p>
        <div class="confirm-actions">
            <button type="button" class="btn btn-outline" id="cancelDeactivate">Cancel</button>
            <button type="button" class="btn btn-primary" id="confirmDeactivate">Deactivate</button>
        </div>
    </div>
</div>

<script>
let pendingDeactivateForm = null;
const deactivateModal = document.getElementById('deactivateConfirm');
document.querySelectorAll('.js-open-deactivate').forEach((button) => {
    button.addEventListener('click', () => {
        pendingDeactivateForm = button.closest('form');
        const userName = pendingDeactivateForm.dataset.userName || 'this user';
        document.getElementById('deactivateText').textContent = `Deactivate ${userName}? They will no longer be able to log in, but task history will remain.`;
        deactivateModal.style.display = 'flex';
    });
});
document.getElementById('cancelDeactivate').addEventListener('click', () => {
    pendingDeactivateForm = null;
    deactivateModal.style.display = 'none';
});
document.getElementById('confirmDeactivate').addEventListener('click', () => {
    if (pendingDeactivateForm) pendingDeactivateForm.submit();
});
deactivateModal.addEventListener('click', (event) => {
    if (event.target === deactivateModal) {
        pendingDeactivateForm = null;
        deactivateModal.style.display = 'none';
    }
});
</script>

<?php $content = ob_get_clean(); require __DIR__ . '/../layouts/main.php'; ?>
