<?php
$pageTitle   = $pageTitle   ?? 'Edit Credential';
$currentPage = $currentPage ?? 'credentials';

ob_start();
?>
<style>
.form-section{background:#18181b;border:1px solid #27272a;border-radius:12px;margin-bottom:16px}
.form-section-header{padding:12px 18px;border-bottom:1px solid #27272a;font-size:12px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:.05em}
.form-section-body{padding:18px;display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:700px){.form-section-body{grid-template-columns:1fr}}
.form-group{display:flex;flex-direction:column;gap:5px}
.form-group.full-width{grid-column:1/-1}
.form-label{font-size:12px;font-weight:600;color:#a1a1aa}
.form-input{background:#1c1c1f;border:1px solid #27272a;color:#e4e4e7;border-radius:8px;padding:9px 12px;font-size:13px;outline:none;transition:border-color .15s;width:100%;box-sizing:border-box}
.form-input:focus{border-color:#3b82f6}
.form-input::placeholder{color:#3f3f46}
.form-textarea{min-height:80px;resize:vertical}
.form-select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center}
.form-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:8px}
.btn{padding:9px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
.btn-primary{background:#1d4ed8;border-color:#2563eb;color:#fff}
.btn-primary:hover{background:#2563eb}
.btn-ghost{background:transparent;border-color:#27272a;color:#a1a1aa}
.btn-ghost:hover{background:#27272a;color:#f4f4f5}
</style>

<?php if ($msg = flash('error')): ?><div class="alert alert-error"><?= e($msg) ?></div><?php endif; ?>

<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
    <a href="<?= APP_URL ?>/security/credentials" style="color:#60a5fa;font-size:13px;text-decoration:none">Credential Vault</a>
    <span style="color:#3f3f46">/</span>
    <a href="<?= APP_URL ?>/security/credentials/<?= $credential['id'] ?>" style="color:#60a5fa;font-size:13px;text-decoration:none"><?= e($credential['service_name']) ?></a>
    <span style="color:#3f3f46">/</span>
    <span style="font-size:13px;color:#71717a">Edit</span>
</div>

<h2 style="font-size:18px;font-weight:700;color:#f4f4f5;margin-bottom:20px">✏️ Edit Credential: <?= e($credential['service_name']) ?></h2>

<form method="POST" action="<?= APP_URL ?>/security/credentials/<?= $credential['id'] ?>" autocomplete="off">
    <input type="hidden" name="csrf" value="<?= csrf_token() ?>">

    <!-- Service Info -->
    <div class="form-section">
        <div class="form-section-header">Service Information</div>
        <div class="form-section-body">
            <div class="form-group">
                <label class="form-label">Service Name *</label>
                <input class="form-input" type="text" name="service_name" value="<?= e($credential['service_name']) ?>" required>
            </div>
            <div class="form-group">
                <label class="form-label">Type</label>
                <select class="form-input form-select" name="credential_type">
                    <option value="login"    <?= ($credential['credential_type']??'login')==='login'    ?'selected':'' ?>>🔑 Login / Password</option>
                    <option value="card"     <?= ($credential['credential_type']??'')==='card'     ?'selected':'' ?>>💳 Card (Credit / Debit)</option>
                    <option value="identity" <?= ($credential['credential_type']??'')==='identity' ?'selected':'' ?>>🪪 ID Document</option>
                    <option value="link"     <?= ($credential['credential_type']??'')==='link'     ?'selected':'' ?>>🔗 Link / URL</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Website URL</label>
                <input class="form-input" type="url" name="website" placeholder="https://example.com" value="<?= e($credential['website'] ?? '') ?>">
            </div>
            <div class="form-group full-width">
                <label class="form-label">Login URL</label>
                <input class="form-input" type="url" name="login_url" placeholder="https://example.com/login" value="<?= e($credential['login_url'] ?? '') ?>">
            </div>
        </div>
    </div>

    <!-- Login Credentials -->
    <div class="form-section">
        <div class="form-section-header">Login Credentials</div>
        <div class="form-section-body">
            <div class="form-group">
                <label class="form-label">Username</label>
                <input class="form-input" type="text" name="username" autocomplete="off" value="<?= e($credential['username'] ?? '') ?>">
            </div>
            <div class="form-group">
                <label class="form-label">Email</label>
                <input class="form-input" type="email" name="email" autocomplete="off" value="<?= e($credential['email'] ?? '') ?>">
            </div>
            <div class="form-group full-width">
                <label class="form-label">New Password <span style="color:#52525b;font-weight:400">(leave blank to keep existing)</span></label>
                <div style="position:relative">
                    <input class="form-input" type="password" name="password" id="pwdInput" autocomplete="new-password" placeholder="Enter new password only if changing…">
                    <button type="button" onclick="document.getElementById('pwdInput').type = document.getElementById('pwdInput').type === 'password' ? 'text' : 'password'" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:#71717a;cursor:pointer;font-size:13px">👁</button>
                </div>
                <?php if ($credential['encrypted_password']): ?>
                <div style="font-size:11px;color:#4ade80;margin-top:4px">✅ A password is currently stored (encrypted)</div>
                <?php else: ?>
                <div style="font-size:11px;color:#71717a;margin-top:4px">No password currently stored</div>
                <?php endif; ?>
            </div>
        </div>
    </div>

    <!-- Rotation Schedule -->
    <div class="form-section">
        <div class="form-section-header">Rotation Schedule</div>
        <div class="form-section-body">
            <div class="form-group">
                <label class="form-label">Change Frequency</label>
                <select class="form-input form-select" name="rotation_frequency_days">
                    <option value="">No rotation policy</option>
                    <?php foreach ([30,60,90,180,365] as $days): ?>
                    <option value="<?= $days ?>" <?= ($credential['rotation_frequency_days'] ?? '') == $days ? 'selected' : '' ?>>Every <?= $days ?> days</option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Last Changed Date</label>
                <input class="form-input" type="date" name="last_changed_at" value="<?= e($credential['last_changed_at'] ? substr($credential['last_changed_at'], 0, 10) : '') ?>">
            </div>
            <div class="form-group full-width">
                <label class="form-label">Change Instructions</label>
                <textarea class="form-input form-textarea" name="password_change_instructions"><?= e($credential['password_change_instructions'] ?? '') ?></textarea>
            </div>
        </div>
    </div>

    <!-- Ownership & Organization -->
    <div class="form-section">
        <div class="form-section-header">Ownership & Organization</div>
        <div class="form-section-body">
            <div class="form-group">
                <label class="form-label">Owner</label>
                <select class="form-input form-select" name="owner_user_id">
                    <option value="">No owner</option>
                    <?php foreach ($users as $u): ?>
                    <option value="<?= $u['id'] ?>" <?= ($credential['owner_user_id'] ?? '') == $u['id'] ? 'selected' : '' ?>>[<?= ucfirst($u['role']) ?>] <?= e($u['name']) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Store</label>
                <select class="form-input form-select" name="store_id">
                    <option value="">All stores / No store</option>
                    <?php foreach ($stores as $s): ?>
                    <option value="<?= $s['id'] ?>" <?= ($credential['store_id'] ?? '') == $s['id'] ? 'selected' : '' ?>><?= e($s['name']) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Department</label>
                <input class="form-input" type="text" name="department" value="<?= e($credential['department'] ?? '') ?>">
            </div>
            <div class="form-group">
                <label class="form-label">Status</label>
                <select class="form-input form-select" name="status">
                    <option value="active" <?= ($credential['status'] ?? '') === 'active' ? 'selected' : '' ?>>Active</option>
                    <option value="inactive" <?= ($credential['status'] ?? '') === 'inactive' ? 'selected' : '' ?>>Inactive</option>
                    <option value="compromised" <?= ($credential['status'] ?? '') === 'compromised' ? 'selected' : '' ?>>Compromised</option>
                </select>
            </div>
            <div class="form-group full-width">
                <label class="form-label">Notes</label>
                <textarea class="form-input form-textarea" name="notes"><?= e($credential['notes'] ?? '') ?></textarea>
            </div>
        </div>
    </div>

    <div class="form-actions">
        <a href="<?= APP_URL ?>/security/credentials/<?= $credential['id'] ?>" class="btn btn-ghost">Cancel</a>
        <button type="submit" class="btn btn-primary">💾 Save Changes</button>
    </div>
</form>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
