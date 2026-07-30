<?php
$pageTitle   = $pageTitle   ?? 'New Credential';
$currentPage = $currentPage ?? 'credentials';

ob_start();
?>
<style>
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:700px){.form-grid{grid-template-columns:1fr}}
.form-section{background:#18181b;border:1px solid #27272a;border-radius:12px;margin-bottom:16px}
.form-section-header{padding:12px 18px;border-bottom:1px solid #27272a;font-size:12px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:.05em}
.form-section-body{padding:18px;display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:700px){.form-section-body{grid-template-columns:1fr}}
.form-section-body.single-col{grid-template-columns:1fr}
.form-group{display:flex;flex-direction:column;gap:5px}
.form-group.full-width{grid-column:1/-1}
.form-label{font-size:12px;font-weight:600;color:#a1a1aa}
.form-label .required{color:#f87171;margin-left:2px}
.form-input{background:#1c1c1f;border:1px solid #27272a;color:#e4e4e7;border-radius:8px;padding:9px 12px;font-size:13px;outline:none;transition:border-color .15s;width:100%;box-sizing:border-box}
.form-input:focus{border-color:#3b82f6}
.form-input::placeholder{color:#3f3f46}
.form-textarea{min-height:80px;resize:vertical}
.form-select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center}
.pwd-strength{height:3px;border-radius:2px;margin-top:4px;transition:all .3s}
.pwd-strength-label{font-size:11px;margin-top:2px}

.form-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:8px}
.btn{padding:9px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
.btn-primary{background:#1d4ed8;border-color:#2563eb;color:#fff}
.btn-primary:hover{background:#2563eb}
.btn-ghost{background:transparent;border-color:#27272a;color:#a1a1aa}
.btn-ghost:hover{background:#27272a;color:#f4f4f5}
</style>

<?php if ($msg = flash('error')): ?><div class="alert alert-error"><?= e($msg) ?></div><?php endif; ?>

<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
    <a href="<?= APP_URL ?>/security/credentials" style="color:#60a5fa;font-size:13px;text-decoration:none">← Credential Vault</a>
    <span style="color:#3f3f46">/</span>
    <span style="font-size:13px;color:#71717a">New Credential</span>
</div>

<h2 style="font-size:18px;font-weight:700;color:#f4f4f5;margin-bottom:20px">🔑 New Credential</h2>

<form method="POST" action="<?= APP_URL ?>/security/credentials" autocomplete="off">
    <input type="hidden" name="csrf" value="<?= csrf_token() ?>">

    <!-- Service Info -->
    <div class="form-section">
        <div class="form-section-header">Service Information</div>
        <div class="form-section-body">
            <div class="form-group">
                <label class="form-label">Service Name <span class="required">*</span></label>
                <input class="form-input" type="text" name="service_name" placeholder="e.g. IRS Portal, Chase Card, Bakudan ID…" value="<?= e($_POST['service_name'] ?? '') ?>" required>
            </div>
            <div class="form-group">
                <label class="form-label">Type <span class="required">*</span></label>
                <select class="form-input form-select" name="credential_type" id="credType">
                    <option value="login"    <?= ($_POST['credential_type']??'login')==='login'    ?'selected':'' ?>>🔑 Login / Password</option>
                    <option value="card"     <?= ($_POST['credential_type']??'')==='card'     ?'selected':'' ?>>💳 Card (Credit / Debit)</option>
                    <option value="identity" <?= ($_POST['credential_type']??'')==='identity' ?'selected':'' ?>>🪪 ID Document</option>
                    <option value="link"     <?= ($_POST['credential_type']??'')==='link'     ?'selected':'' ?>>🔗 Link / URL</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Website URL</label>
                <input class="form-input" type="url" name="website" placeholder="https://example.com" value="<?= e($_POST['website'] ?? '') ?>">
            </div>
            <div class="form-group full-width">
                <label class="form-label">Login URL</label>
                <input class="form-input" type="url" name="login_url" placeholder="https://example.com/login" value="<?= e($_POST['login_url'] ?? '') ?>">
            </div>
        </div>
    </div>

    <!-- Login Credentials -->
    <div class="form-section">
        <div class="form-section-header">Login Credentials</div>
        <div class="form-section-body">
            <div class="form-group">
                <label class="form-label">Username</label>
                <input class="form-input" type="text" name="username" autocomplete="off" placeholder="Username" value="<?= e($_POST['username'] ?? '') ?>">
            </div>
            <div class="form-group">
                <label class="form-label">Email</label>
                <input class="form-input" type="email" name="email" autocomplete="off" placeholder="login@example.com" value="<?= e($_POST['email'] ?? '') ?>">
            </div>
            <div class="form-group full-width">
                <label class="form-label">Password</label>
                <div style="position:relative">
                    <input class="form-input" type="password" name="password" id="pwdInput" autocomplete="new-password" placeholder="Enter password to store (encrypted with AES-256-GCM)">
                    <button type="button" onclick="togglePwdVisibility()" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:#71717a;cursor:pointer;font-size:13px">👁</button>
                </div>
                <div class="pwd-strength" id="pwdStrength" style="background:#27272a"></div>
                <div class="pwd-strength-label" id="pwdStrengthLabel" style="color:#52525b"></div>
                <div style="font-size:11px;color:#52525b;margin-top:4px">🔒 Encrypted with AES-256-GCM before storage. Never stored in plaintext.</div>
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
                    <option value="30" <?= ($_POST['rotation_frequency_days'] ?? '') == 30 ? 'selected' : '' ?>>Every 30 days</option>
                    <option value="60" <?= ($_POST['rotation_frequency_days'] ?? '') == 60 ? 'selected' : '' ?>>Every 60 days</option>
                    <option value="90" <?= ($_POST['rotation_frequency_days'] ?? '') == 90 ? 'selected' : '' ?>>Every 90 days</option>
                    <option value="180" <?= ($_POST['rotation_frequency_days'] ?? '') == 180 ? 'selected' : '' ?>>Every 180 days</option>
                    <option value="365" <?= ($_POST['rotation_frequency_days'] ?? '') == 365 ? 'selected' : '' ?>>Every 365 days</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Last Changed Date</label>
                <input class="form-input" type="date" name="last_changed_at" value="<?= e($_POST['last_changed_at'] ?? date('Y-m-d')) ?>">
                <div style="font-size:11px;color:#52525b;margin-top:3px">Used to calculate next rotation due date</div>
            </div>
            <div class="form-group full-width">
                <label class="form-label">Change Instructions</label>
                <textarea class="form-input form-textarea" name="password_change_instructions" placeholder="Step-by-step instructions on how to change this password…"><?= e($_POST['password_change_instructions'] ?? '') ?></textarea>
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
                    <option value="">Select owner…</option>
                    <?php foreach ($users as $u): ?>
                    <option value="<?= $u['id'] ?>" <?= ($_POST['owner_user_id'] ?? '') == $u['id'] ? 'selected' : '' ?>>
                        [<?= ucfirst($u['role']) ?>] <?= e($u['name']) ?>
                    </option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Store</label>
                <select class="form-input form-select" name="store_id">
                    <option value="">All stores / No store</option>
                    <?php foreach ($stores as $s): ?>
                    <option value="<?= $s['id'] ?>" <?= ($_POST['store_id'] ?? '') == $s['id'] ? 'selected' : '' ?>><?= e($s['name']) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Department</label>
                <input class="form-input" type="text" name="department" placeholder="e.g. Finance, IT, Operations" value="<?= e($_POST['department'] ?? '') ?>">
            </div>
            <div class="form-group">
                <label class="form-label">Status</label>
                <select class="form-input form-select" name="status">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            </div>
            <div class="form-group full-width">
                <label class="form-label">Notes</label>
                <textarea class="form-input form-textarea" name="notes" placeholder="Additional notes…"><?= e($_POST['notes'] ?? '') ?></textarea>
            </div>
        </div>
    </div>

    <div class="form-actions">
        <a href="<?= APP_URL ?>/security/credentials" class="btn btn-ghost">Cancel</a>
        <button type="submit" class="btn btn-primary">🔒 Save Credential</button>
    </div>
</form>

<script>
function togglePwdVisibility() {
    var inp = document.getElementById('pwdInput');
    inp.type = inp.type === 'password' ? 'text' : 'password';
}
document.getElementById('pwdInput').addEventListener('input', function() {
    var v = this.value;
    var strength = 0;
    if (v.length >= 8) strength++;
    if (v.length >= 16) strength++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) strength++;
    if (/[0-9]/.test(v)) strength++;
    if (/[^A-Za-z0-9]/.test(v)) strength++;
    var colors = ['#f87171','#f87171','#fbbf24','#4ade80','#4ade80','#22c55e'];
    var labels = ['','Very Weak','Weak','Fair','Good','Strong'];
    var bar = document.getElementById('pwdStrength');
    var lbl = document.getElementById('pwdStrengthLabel');
    bar.style.width = (strength * 20) + '%';
    bar.style.background = colors[strength] || '#27272a';
    lbl.textContent = v.length ? (labels[strength] || '') : '';
    lbl.style.color = colors[strength] || '#52525b';
});
</script>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
