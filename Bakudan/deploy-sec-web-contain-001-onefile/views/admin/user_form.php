<?php
$isEdit = !empty($user);
$pageTitle = $isEdit ? 'Edit User' : 'Add User';
$currentPage = 'admin-users';
$roleLabels = ['admin' => 'Admin', 'ceo' => 'CEO', 'manager' => 'Manager', 'accountant' => 'Accountant', 'member' => 'User'];
$selectedRole = $user['role'] ?? 'member';
$selectedStore = $user['store_id'] ?? '';
$selectedStoreIds = $userStoreIds ?? ($selectedStore !== '' ? [(int)$selectedStore] : []);
$isSelf = $isEdit && (int)$user['id'] === (int)$_SESSION['user_id'];
ob_start();
?>
<style>
.user-form-shell{max-width:760px}
.user-form-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
.user-form-head h2{margin:0;font-size:24px}
.user-form-card{border:1px solid var(--border);border-radius:12px;background:var(--bg-secondary);padding:18px}
.user-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.user-form-grid .full{grid-column:1 / -1}
.user-form-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}
.check-row{display:flex;align-items:center;gap:8px;min-height:42px}
.store-check-list{display:flex;flex-direction:column;gap:6px;margin-top:6px}
.store-check-item{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--text-primary)}
.store-check-item input[type=checkbox]{width:16px;height:16px;accent-color:#3b82f6;cursor:pointer;flex-shrink:0}
@media (max-width: 720px){
  .user-form-grid{grid-template-columns:1fr}
  .user-form-actions{flex-direction:column-reverse}
  .user-form-actions .btn{width:100%;justify-content:center}
}
</style>

<div class="user-form-shell">
    <div class="user-form-head">
        <div>
            <h2><?= $isEdit ? 'Edit User' : 'Add User' ?></h2>
            <div class="text-muted text-sm"><?= $isEdit ? 'Update account permissions and login state.' : 'Create a staff account without public self-registration.' ?></div>
        </div>
        <a href="<?= APP_URL ?>/admin/users" class="btn btn-outline">Back</a>
    </div>

    <form method="POST" action="<?= $isEdit ? APP_URL . '/admin/users/' . (int)$user['id'] : APP_URL . '/admin/users' ?>" class="user-form-card">
        <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
        <div class="user-form-grid">
            <div class="form-group">
                <label>Name</label>
                <input type="text" name="name" class="form-control" value="<?= e($user['name'] ?? '') ?>" required>
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" name="email" class="form-control" value="<?= e($user['email'] ?? '') ?>" required>
            </div>
            <div class="form-group">
                <label>Role</label>
                <select name="role" class="form-control" <?= $isSelf ? 'disabled' : '' ?>>
                    <?php foreach ($roleLabels as $role => $label): ?>
                        <option value="<?= e($role) ?>" <?= $selectedRole === $role ? 'selected' : '' ?>><?= e($label) ?></option>
                    <?php endforeach; ?>
                </select>
                <?php if ($isSelf): ?>
                    <input type="hidden" name="role" value="<?= e($selectedRole) ?>">
                    <div class="text-muted text-sm" style="margin-top:6px">You cannot change your own role.</div>
                <?php endif; ?>
            </div>
            <div class="form-group full">
                <label>Stores <span class="text-muted" style="font-weight:400;font-size:12px">(leave all unchecked = access all stores)</span></label>
                <?php if (empty($stores)): ?>
                    <div class="text-muted text-sm">No stores configured.</div>
                <?php else: ?>
                <div class="store-check-list">
                    <?php foreach ($stores as $store): ?>
                    <label class="store-check-item">
                        <input type="checkbox" name="store_ids[]" value="<?= (int)$store['id'] ?>"
                            <?= in_array((int)$store['id'], array_map('intval', $selectedStoreIds)) ? 'checked' : '' ?>>
                        <?= e($store['name']) ?>
                    </label>
                    <?php endforeach; ?>
                </div>
                <?php endif; ?>
            </div>
            <div class="form-group full">
                <label><?= $isEdit ? 'New Password' : 'Password' ?></label>
                <input type="password" name="password" class="form-control" minlength="6" <?= $isEdit ? '' : 'required' ?>>
                <?php if ($isEdit): ?><div class="text-muted text-sm" style="margin-top:6px">Leave blank to keep the current password.</div><?php endif; ?>
            </div>
            <?php if ($isEdit): ?>
            <div class="form-group full">
                <label class="check-row">
                    <input type="checkbox" name="is_active" value="1" <?= !empty($user['is_active']) ? 'checked' : '' ?> <?= $isSelf ? 'disabled' : '' ?>>
                    Active account
                </label>
                <?php if ($isSelf): ?>
                    <input type="hidden" name="is_active" value="1">
                    <div class="text-muted text-sm">You cannot deactivate your own account.</div>
                <?php endif; ?>
            </div>
            <?php else: ?>
                <input type="hidden" name="is_active" value="1">
            <?php endif; ?>
        </div>

        <div class="user-form-actions">
            <a href="<?= APP_URL ?>/admin/users" class="btn btn-outline">Cancel</a>
            <button type="submit" class="btn btn-primary"><?= $isEdit ? 'Save Changes' : 'Create User' ?></button>
        </div>
    </form>
</div>

<?php $content = ob_get_clean(); require __DIR__ . '/../layouts/main.php'; ?>
