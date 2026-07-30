<?php
/**
 * Phase 8 — Module 5: Enterprise Workflow Engine View
 */
$pageTitle = 'Workflows';
?>

<div style="max-width: 1200px; margin: 0 auto; padding: 20px;">
    <h1 style="font-size: 28px; margin-bottom: 24px;">⚙️ Enterprise Workflow Engine</h1>

    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
        <div>
            <div class="card">
                <h2 style="font-size: 18px; margin: 0 0 16px;">Active Workflows</h2>
                <?php if (empty($workflows)): ?>
                <p style="color: #6b7280;">No workflows configured. Create one or use a template.</p>
                <?php else: ?>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <th style="text-align: left; padding: 8px;">Name</th>
                        <th style="text-align: left; padding: 8px;">Trigger</th>
                        <th style="text-align: left; padding: 8px;">Steps</th>
                        <th style="text-align: left; padding: 8px;">Runs</th>
                        <th style="text-align: left; padding: 8px;">Actions</th>
                    </tr>
                    <?php foreach ($workflows as $wf): ?>
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px 8px;"><?= htmlspecialchars($wf['name']) ?></td>
                        <td style="padding: 12px 8px;"><span style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px; font-size: 12px;"><?= $wf['trigger_type'] ?></span></td>
                        <td style="padding: 12px 8px;"><?= count($wf['steps'] ?? []) ?></td>
                        <td style="padding: 12px 8px;"><?= $wf['execution_count'] ?></td>
                        <td style="padding: 12px 8px;">
                            <button class="btn-small">Edit</button>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </table>
                <?php endif; ?>
            </div>

            <div class="card" style="margin-top: 24px;">
                <h2 style="font-size: 18px; margin: 0 0 16px;">Workflow Templates</h2>
                <div style="display: grid; gap: 12px;">
                    <?php foreach ($templates as $tpl): ?>
                    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
                        <h3 style="margin: 0 0 8px;"><?= htmlspecialchars($tpl['name']) ?></h3>
                        <p style="color: #6b7280; font-size: 14px; margin: 0 0 12px;"><?= htmlspecialchars($tpl['description']) ?></p>
                        <button class="btn-primary btn-small" onclick="createFromTemplate(<?= htmlspecialchars(json_encode($tpl)) ?>)">Use Template</button>
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>

        <div>
            <div class="card">
                <h2 style="font-size: 18px; margin: 0 0 16px;">Create Workflow</h2>
                <form action="/admin/command-center/workflows" method="POST">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-weight: 500; margin-bottom: 4px;">Name</label>
                        <input type="text" name="name" required style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;">
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-weight: 500; margin-bottom: 4px;">Trigger Type</label>
                        <select name="trigger_type" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;">
                            <option value="event">Event</option>
                            <option value="schedule">Schedule</option>
                            <option value="threshold">Threshold</option>
                            <option value="manual">Manual</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-weight: 500; margin-bottom: 4px;">Trigger Config (JSON)</label>
                        <textarea name="trigger_config" rows="3" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-family: monospace;">{}</textarea>
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; font-weight: 500; margin-bottom: 4px;">Steps (JSON)</label>
                        <textarea name="steps" rows="4" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-family: monospace;">[]</textarea>
                    </div>
                    <button type="submit" class="btn-primary" style="width: 100%;">Create Workflow</button>
                </form>
            </div>
        </div>
    </div>
</div>

<style>
.card { background: white; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb; }
.btn-primary { background: #3b82f6; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; }
.btn-small { background: #f3f4f6; padding: 4px 12px; border: none; border-radius: 4px; cursor: pointer; }
</style>

<script>
function createFromTemplate(template) {
    document.querySelector('[name="name"]').value = template.name;
    document.querySelector('[name="trigger_type"]').value = template.trigger_type;
    document.querySelector('[name="trigger_config"]').value = JSON.stringify(template.trigger_config, null, 2);
    document.querySelector('[name="steps"]').value = JSON.stringify(template.steps, null, 2);
}
</script>

