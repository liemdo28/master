<?php
$pageTitle = 'User · ' . ($user['name'] ?? '');
$currentPage = 'admin-users';
ob_start();
?>
<style>
/* Admin detail shared styles (user + store) */
.ad-hero{display:flex;align-items:center;gap:16px;padding:20px;border:1px solid var(--border);border-radius:18px;background:linear-gradient(135deg,rgba(99,102,241,.12),rgba(34,197,94,.06));margin-bottom:18px}
.ad-hero-avatar{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#fff;flex-shrink:0}
.ad-hero-main h2{margin:0;font-size:22px;font-weight:700}
.ad-hero-meta{color:var(--text-muted);margin-top:4px;font-size:13px;display:flex;gap:12px;flex-wrap:wrap}
.ad-hero-back{margin-left:auto;display:flex;gap:8px}
.ad-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:18px}
.ad-stat{border:1px solid var(--border);border-radius:12px;padding:14px;background:var(--bg-secondary)}
.ad-stat-label{font-size:11px;text-transform:uppercase;color:var(--text-muted);letter-spacing:.06em;margin-bottom:4px}
.ad-stat-val{font-size:24px;font-weight:700}
.ad-stat.ad-stat-overdue .ad-stat-val{color:#ef4444}
.ad-stat.ad-stat-today .ad-stat-val{color:#f59e0b}
.ad-stat.ad-stat-done .ad-stat-val{color:#22c55e}
.ad-stat.ad-stat-rec .ad-stat-val{color:#a5b4fc}
.ad-section{border:1px solid var(--border);border-radius:14px;margin-bottom:16px;background:var(--bg-secondary);overflow:hidden}
.ad-section-head{padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;font-weight:600}
.ad-section-body{padding:12px}
.ad-task-list{display:flex;flex-direction:column;gap:8px}
.ad-task{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid var(--border);border-left:3px solid #6366f1;border-radius:10px;background:var(--bg-primary);color:inherit;text-decoration:none;transition:background .12s,border-color .12s,transform .08s}
.ad-task:hover{background:rgba(99,102,241,.08);border-color:rgba(99,102,241,.35)}
.ad-task-title{font-weight:600;font-size:14px;line-height:1.35;margin-bottom:6px}
.ad-task-meta{display:flex;flex-wrap:wrap;gap:5px;font-size:11px;color:var(--text-muted)}
.ad-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}
.ad-chip-pri-urgent{background:#dc2626;color:#fff;border-color:#dc2626}
.ad-chip-pri-high{background:#f59e0b;color:#111;border-color:#f59e0b}
.ad-chip-pri-medium{background:rgba(59,130,246,.2);color:#bfdbfe}
.ad-chip-pri-low{background:rgba(113,113,122,.15);color:#d4d4d8}
.ad-chip-overdue{background:#dc2626;color:#fff;font-weight:600;border-color:#dc2626}
.ad-chip-today{background:#f59e0b;color:#111;font-weight:600;border-color:#f59e0b}
.ad-chip-rec{background:rgba(99,102,241,.25);color:#c7d2fe;border-color:rgba(99,102,241,.5)}
.ad-task-side{font-size:12px;color:var(--text-muted);flex-shrink:0;text-align:right}
.ad-due-overdue{color:#fca5a5;font-weight:600}
.ad-due-today{color:#fcd34d;font-weight:600}
.ad-task-done{opacity:.5}
.ad-task-done .ad-task-title{text-decoration:line-through}
.ad-task-overdue{border-left-color:#dc2626 !important;background:rgba(239,68,68,.05)}
.ad-task-today{border-left-color:#f59e0b !important;background:rgba(245,158,11,.04)}
.ad-empty{padding:40px;text-align:center;color:var(--text-muted);font-size:13px}
</style>

<?php
$avatarBg = $user['role'] === 'admin' ? '#dc2626' : ($user['role'] === 'manager' ? '#6366f1' : '#22c55e');
$roleLabel = ['admin'=>'Admin','manager'=>'Manager','member'=>'Member'][$user['role']] ?? $user['role'];
?>

<div class="ad-hero">
    <?php if (!empty($user['avatar'])): ?>
        <img class="ad-hero-avatar" src="<?= e($user['avatar']) ?>" alt="" style="object-fit:cover">
    <?php else: ?>
        <div class="ad-hero-avatar" style="background:<?= e($avatarBg) ?>"><?= e(mb_strtoupper(mb_substr($user['name'] ?? '?', 0, 1))) ?></div>
    <?php endif; ?>
    <div class="ad-hero-main">
        <h2><?= e($user['name']) ?></h2>
        <div class="ad-hero-meta">
            <span>📧 <?= e($user['email']) ?></span>
            <span class="badge badge-<?= e($user['role']) ?>"><?= e($roleLabel) ?></span>
            <span class="badge badge-<?= $user['is_active'] ? 'active' : 'inactive' ?>">
                <?= $user['is_active'] ? '✓ Active' : '○ Inactive' ?>
            </span>
            <?php if (!empty($user['timezone'])): ?><span>🌐 <?= e($user['timezone']) ?></span><?php endif; ?>
            <span>Password reset: <?= !empty($user['password_reset_at']) ? e(date('Y-m-d H:i', strtotime($user['password_reset_at']))) : 'Never' ?></span>
        </div>
    </div>
    <div class="ad-hero-back">
        <a href="<?= APP_URL ?>/admin/users/<?= (int)$user['id'] ?>/edit" class="btn btn-outline btn-sm">Edit</a>
        <a href="<?= APP_URL ?>/admin/users" class="btn btn-outline btn-sm">← Back</a>
    </div>
</div>

<div class="ad-stats">
    <div class="ad-stat"><div class="ad-stat-label">Assigned</div><div class="ad-stat-val"><?= $stats['total'] ?></div></div>
    <div class="ad-stat ad-stat-overdue"><div class="ad-stat-label">Overdue</div><div class="ad-stat-val">🔥 <?= $stats['overdue'] ?></div></div>
    <div class="ad-stat ad-stat-today"><div class="ad-stat-label">Today</div><div class="ad-stat-val">● <?= $stats['today'] ?></div></div>
    <div class="ad-stat"><div class="ad-stat-label">Upcoming</div><div class="ad-stat-val"><?= $stats['upcoming'] ?></div></div>
    <div class="ad-stat ad-stat-done"><div class="ad-stat-label">Completed</div><div class="ad-stat-val">✓ <?= $stats['completed'] ?></div></div>
    <div class="ad-stat ad-stat-rec"><div class="ad-stat-label">Recurring</div><div class="ad-stat-val">↻ <?= $stats['recurring'] ?></div></div>
    <div class="ad-stat"><div class="ad-stat-label">Public</div><div class="ad-stat-val"><?= (int)($privacyCounts['public_count'] ?? 0) ?></div></div>
    <div class="ad-stat"><div class="ad-stat-label">Private</div><div class="ad-stat-val"><?= (int)($privacyCounts['private_count'] ?? 0) ?></div></div>
</div>

<div class="ad-section">
    <div class="ad-section-head">
        <span>Password Control</span>
    </div>
    <div class="ad-section-body">
        <p class="text-muted text-sm" style="margin-top:0">Passwords are one-way hashes. Admins can set a new password but cannot view the existing password.</p>
        <form method="POST" action="<?= APP_URL ?>/admin/users/<?= (int)$user['id'] ?>/reset-password" style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">
            <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
            <div class="form-group" style="margin:0;min-width:220px">
                <label>New Password</label>
                <input type="password" name="password" class="form-control" minlength="6" required>
            </div>
            <button type="submit" class="btn btn-primary">Reset Password</button>
        </form>
    </div>
</div>

<div class="ad-section">
    <div class="ad-section-head">
        <span>📝 Assigned Tasks (<?= count($tasksAssigned) ?>)</span>
    </div>
    <div class="ad-section-body">
        <?php $rowTasks = $tasksAssigned; $showAssignee = false; $emptyMsg = 'No tasks assigned.'; include __DIR__ . '/_task_row_partial.php'; ?>
    </div>
</div>

<?php if (!empty($tasksCreated)): ?>
<div class="ad-section">
    <div class="ad-section-head">
        <span>✏️ Tasks created by this user (<?= count($tasksCreated) ?>)</span>
    </div>
    <div class="ad-section-body">
        <?php $rowTasks = $tasksCreated; $showAssignee = true; $emptyMsg = ''; include __DIR__ . '/_task_row_partial.php'; ?>
    </div>
</div>
<?php endif; ?>

<?php if (!empty($tasksWatched)): ?>
<div class="ad-section">
    <div class="ad-section-head">
        <span>👁 Watching (<?= count($tasksWatched) ?>)</span>
    </div>
    <div class="ad-section-body">
        <?php $rowTasks = $tasksWatched; $showAssignee = true; $emptyMsg = ''; include __DIR__ . '/_task_row_partial.php'; ?>
    </div>
</div>
<?php endif; ?>

<?php $content = ob_get_clean(); require __DIR__ . '/../layouts/main.php'; ?>
