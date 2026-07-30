<?php
$pageTitle = 'Create Release Draft';
$currentPage = 'admin-releases';
ob_start();
?>

<style>
.rc-form{max-width:720px}
.rc-card{background:#18181b;border:1px solid #27272a;border-radius:10px;padding:24px;margin-bottom:16px}
.rc-row{margin-bottom:16px}
.rc-row label{display:block;font-size:13px;color:#a1a1aa;margin-bottom:6px;font-weight:500}
.rc-row input,.rc-row textarea,.rc-row select{width:100%;background:#09090b;border:1px solid #27272a;color:#f4f4f5;padding:10px 14px;border-radius:8px;font-size:14px;box-sizing:border-box}
.rc-row input:focus,.rc-row textarea:focus,.rc-row select:focus{outline:none;border-color:#3b82f6}
.rc-row textarea{min-height:100px;resize:vertical;font-family:inherit}
.rc-row .hint{font-size:12px;color:#71717a;margin-top:4px}
.rc-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.rc-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.rc-section{font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:.5px;padding-bottom:8px;margin-bottom:16px;border-bottom:1px solid #27272a;display:flex;align-items:center;gap:8px}
.rc-section-icon{font-size:14px}
.rc-actions{display:flex;gap:12px;margin-top:24px}
.rc-btn{padding:10px 20px;border-radius:8px;font-size:14px;font-weight:500;border:none;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
.rc-btn--primary{background:#3b82f6;color:#fff}.rc-btn--primary:hover{background:#2563eb}
.rc-btn--ghost{background:transparent;color:#a1a1aa;border:1px solid #27272a}.rc-btn--ghost:hover{background:#27272a;color:#f4f4f5}
textarea{min-height:100px!important}
</style>

<div style="margin-bottom:16px">
    <a href="<?= APP_URL ?>/admin/releases" style="color:#71717a;text-decoration:none;font-size:14px">&#8592; Back to Releases</a>
</div>

<?php if ($msg = flash('error')): ?>
<div style="background:#450a0a;border:1px solid #7f1d1d;color:#fca5a5;padding:12px 16px;border-radius:8px;margin-bottom:16px;font-size:14px"><?= e($msg) ?></div>
<?php endif; ?>

<div class="rc-form">
    <form method="POST" action="<?= APP_URL ?>/admin/releases/create">
        <input type="hidden" name="csrf_token" value="<?= csrf_token() ?>">

        <!-- Basic Info -->
        <div class="rc-card">
            <div class="rc-section">
                <span class="rc-section-icon">&#128203;</span>
                <span>Basic Information</span>
            </div>
            <div class="rc-grid">
                <div class="rc-row">
                    <label>Release Name *</label>
                    <input type="text" name="name" required placeholder="e.g. Sprint 14 — Calendar Fix">
                </div>
                <div class="rc-row">
                    <label>Version *</label>
                    <input type="text" name="version" required placeholder="e.g. 2.4.0">
                </div>
            </div>
            <div class="rc-row">
                <label>Title / Headline</label>
                <input type="text" name="title" placeholder="Short headline for this release">
                <div class="hint">Optional short title shown in version banners and modals</div>
            </div>
            <div class="rc-row">
                <label>Summary</label>
                <textarea name="summary" placeholder="One paragraph summary of what this release accomplishes..."></textarea>
            </div>
            <div class="rc-grid">
                <div class="rc-row">
                    <label>Branch</label>
                    <input type="text" name="branch" placeholder="e.g. feature/calendar-recurrence">
                </div>
                <div class="rc-row">
                    <label>Commit Hash</label>
                    <input type="text" name="commit_hash" placeholder="e.g. a1b2c3d4">
                </div>
            </div>
            <div class="rc-row">
                <label>Preview URL</label>
                <input type="url" name="preview_url" placeholder="e.g. https://preview.dashboard.bakudanramen.com/release/14">
            </div>
        </div>

        <!-- Release Notes -->
        <div class="rc-card">
            <div class="rc-section">
                <span class="rc-section-icon">&#128221;</span>
                <span>Release Notes</span>
            </div>
            <div class="rc-row">
                <label>What Changed</label>
                <textarea name="release_notes" placeholder="Overview of changes, new functionality, and improvements..."></textarea>
            </div>
            <div class="rc-row">
                <label>Changelog / New Features</label>
                <textarea name="change_log" placeholder="- Added calendar recurrence support&#10;- Improved task filtering performance&#10;- New dark mode toggle"></textarea>
                <div class="hint">List new features, improvements, and breaking changes</div>
            </div>
            <div class="rc-row">
                <label>Bug Fixes</label>
                <textarea name="bug_fixes" placeholder="- Fixed calendar not syncing with Google&#10;- Resolved overdue task notification delay&#10;- Fixed bill export formatting"></textarea>
            </div>
        </div>

        <!-- Risk & Rollback -->
        <div class="rc-card">
            <div class="rc-section">
                <span class="rc-section-icon">&#128737;</span>
                <span>Risk & Rollback Plan</span>
            </div>
            <div class="rc-row">
                <label>Known Issues</label>
                <textarea name="known_issues" placeholder="- File upload may be slow on mobile&#10;- Export feature requires IE11 polyfill for some users"></textarea>
            </div>
            <div class="rc-row">
                <label>Risk Notes</label>
                <textarea name="risk_notes" placeholder="Any potential risks or concerns with this release..."></textarea>
            </div>
            <div class="rc-row">
                <label>Rollback Plan</label>
                <textarea name="rollback_notes" placeholder="Steps to safely rollback this release if needed..."></textarea>
            </div>
            <div class="rc-row">
                <label>Rollback Contact</label>
                <input type="text" name="rollback_contact" placeholder="e.g. admin@bakudanramen.com or @liemdo">
                <div class="hint">Who to contact if rollback is needed</div>
            </div>
        </div>

        <div class="rc-actions">
            <button type="submit" class="rc-btn rc-btn--primary">Create Draft</button>
            <a href="<?= APP_URL ?>/admin/releases" class="rc-btn rc-btn--ghost">Cancel</a>
        </div>
    </form>
</div>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
