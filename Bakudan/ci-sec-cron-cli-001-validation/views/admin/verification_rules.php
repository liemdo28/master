<?php
$pageTitle = 'Verification Rules Preview';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verification Rules Preview</title>
    <style>
        body { margin:0; font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:#0b0f14; color:#e5e7eb; }
        .wrap { max-width:1180px; margin:0 auto; padding:28px; }
        .top { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:22px; }
        h1 { margin:0; font-size:24px; font-weight:700; }
        .grid { display:grid; grid-template-columns:360px 1fr; gap:18px; align-items:start; }
        .panel { background:#111827; border:1px solid #263241; border-radius:8px; padding:18px; }
        .panel h2 { margin:0 0 14px; font-size:16px; }
        label { display:block; font-size:12px; color:#9ca3af; margin:12px 0 6px; }
        input, select { width:100%; box-sizing:border-box; background:#0b1220; color:#f9fafb; border:1px solid #374151; border-radius:6px; padding:10px; }
        .toggle { display:flex; gap:10px; align-items:center; margin-top:6px; }
        .toggle input { width:auto; }
        .steps { display:grid; gap:12px; }
        .step { border:1px solid #2f3b4d; border-radius:8px; padding:14px; background:#0f172a; }
        .step-head { font-weight:650; margin-bottom:8px; }
        .row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .checks { display:flex; gap:18px; flex-wrap:wrap; margin-top:10px; }
        .checks label { display:flex; align-items:center; gap:8px; margin:0; color:#d1d5db; }
        .checks input { width:auto; }
        .btn { background:#2563eb; color:#fff; border:0; border-radius:6px; padding:10px 14px; font-weight:650; cursor:pointer; }
        .muted { color:#94a3b8; font-size:13px; }
        @media (max-width: 900px) { .grid, .row { grid-template-columns:1fr; } .wrap { padding:18px; } }
    </style>
</head>
<body>
<main class="wrap">
    <div class="top">
        <div>
            <h1>Verification Rules Preview</h1>
            <div class="muted">Preview-only configuration surface. Saving and enforcement are intentionally disabled.</div>
        </div>
        <a class="btn" href="/overview" style="text-decoration:none">Back</a>
    </div>

    <form class="grid" method="post" action="/admin/verification-rules-preview">
        <section class="panel">
            <h2>Rule</h2>

            <label for="name">Template Name</label>
            <input id="name" name="name" placeholder="Payment request verification">

            <label for="object_type">Object Type</label>
            <select id="object_type" name="object_type">
                <option value="task">Task</option>
                <option value="bill">Bill</option>
                <option value="payment">Payment</option>
                <option value="payroll">Payroll</option>
                <option value="form">Form</option>
                <option value="audit">Audit</option>
                <option value="checklist">Checklist</option>
            </select>

            <label>Require Verification?</label>
            <div class="toggle">
                <label><input type="radio" name="require_verification" value="1" checked> Yes</label>
                <label><input type="radio" name="require_verification" value="0"> No</label>
            </div>

            <label for="store_id">Store Scope</label>
            <select id="store_id" name="store_id">
                <option value="">All stores</option>
            </select>

            <label for="owner_role">Owner Role</label>
            <select id="owner_role" name="owner_role">
                <option value="">Any</option>
                <option value="member">Member</option>
                <option value="manager">Manager</option>
                <option value="accounting">Accounting</option>
                <option value="admin">Admin</option>
                <option value="ceo">CEO</option>
            </select>
        </section>

        <section class="panel">
            <h2>Verification Steps</h2>
            <div class="steps">
                <?php for ($i = 1; $i <= 5; $i++): ?>
                    <div class="step">
                        <div class="step-head">Step <?= $i ?></div>
                        <div class="row">
                            <div>
                                <label for="step_<?= $i ?>_user">Assigned User</label>
                                <select id="step_<?= $i ?>_user" name="steps[<?= $i ?>][assigned_user_id]">
                                    <option value="">None</option>
                                    <?php foreach ($users as $user): ?>
                                        <option value="<?= (int)$user['id'] ?>"><?= htmlspecialchars($user['name'] ?? '') ?></option>
                                    <?php endforeach; ?>
                                </select>
                            </div>
                            <div>
                                <label for="step_<?= $i ?>_role">Assigned Role</label>
                                <select id="step_<?= $i ?>_role" name="steps[<?= $i ?>][assigned_role]">
                                    <option value="">None</option>
                                    <option value="manager">Manager</option>
                                    <option value="accounting">Accounting</option>
                                    <option value="admin">Admin</option>
                                    <option value="ceo">CEO</option>
                                    <option value="auditor">Auditor</option>
                                </select>
                            </div>
                        </div>
                        <label for="step_<?= $i ?>_due">Step Due Time</label>
                        <input id="step_<?= $i ?>_due" type="datetime-local" name="steps[<?= $i ?>][due_at]">
                        <div class="checks">
                            <label><input type="checkbox" name="steps[<?= $i ?>][required_comment]" value="1"> Required Comment</label>
                            <label><input type="checkbox" name="steps[<?= $i ?>][required_evidence]" value="1"> Required Evidence</label>
                        </div>
                    </div>
                <?php endfor; ?>
            </div>
            <div style="margin-top:16px">
                <button class="btn" type="button" disabled>Preview Only</button>
                <span class="muted" style="margin-left:10px">No production rule is saved from this preview screen.</span>
            </div>
        </section>
    </form>
</main>
</body>
</html>
