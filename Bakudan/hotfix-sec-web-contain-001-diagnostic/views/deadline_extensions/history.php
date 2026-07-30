<?php
$pageTitle = 'My Deadline Extensions';
$activeNav = 'my-tasks';
ob_start();
?>
<div class="container" style="max-width:900px;margin:0 auto;padding:24px 16px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
    <div>
      <h1 style="font-size:1.4rem;font-weight:700;color:#F0F6FC;margin:0;">Deadline Extensions</h1>
      <p style="color:#8B949E;font-size:.875rem;margin:4px 0 0;">Your extension request history</p>
    </div>
    <!-- Quota badge -->
    <div style="background:#161B22;border:1px solid #30363D;border-radius:8px;padding:12px 20px;text-align:center;">
      <div style="font-size:1.5rem;font-weight:700;color:<?= $quotaStatus['remaining'] > 0 ? '#3FB950' : '#F85149' ?>;">
        <?= $quotaStatus['remaining'] ?>/<?= $quotaStatus['quota'] ?>
      </div>
      <div style="font-size:.75rem;color:#8B949E;margin-top:2px;">Self-extensions left this month</div>
    </div>
  </div>

  <?php if (empty($extensions)): ?>
    <div style="text-align:center;padding:60px 24px;color:#484F58;">
      <p style="font-size:1rem;">No extension requests yet.</p>
    </div>
  <?php else: ?>
  <div style="background:#0D1117;border:1px solid #21262D;border-radius:8px;overflow:hidden;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#161B22;border-bottom:1px solid #21262D;">
          <th style="padding:10px 16px;text-align:left;font-size:.75rem;font-weight:600;color:#8B949E;text-transform:uppercase;letter-spacing:.05em;">Task</th>
          <th style="padding:10px 16px;text-align:left;font-size:.75rem;font-weight:600;color:#8B949E;text-transform:uppercase;letter-spacing:.05em;">Extension</th>
          <th style="padding:10px 16px;text-align:left;font-size:.75rem;font-weight:600;color:#8B949E;text-transform:uppercase;letter-spacing:.05em;">Status</th>
          <th style="padding:10px 16px;text-align:left;font-size:.75rem;font-weight:600;color:#8B949E;text-transform:uppercase;letter-spacing:.05em;">Requested</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($extensions as $ext): ?>
        <?php
          $statusColors = [
            'auto_approved' => ['#3FB950', '#0D2D0D'],
            'approved'      => ['#3FB950', '#0D2D0D'],
            'pending'       => ['#D29922', '#2D1F00'],
            'rejected'      => ['#F85149', '#2D0D0D'],
            'expired'       => ['#8B949E', '#21262D'],
          ];
          [$sc, $sbg] = $statusColors[$ext['status']] ?? ['#8B949E', '#21262D'];
          $statusLabel = [
            'auto_approved' => 'Auto-approved',
            'approved'      => 'Approved',
            'pending'       => 'Pending',
            'rejected'      => 'Rejected',
            'expired'       => 'Expired',
          ][$ext['status']] ?? $ext['status'];
        ?>
        <tr style="border-bottom:1px solid #21262D;">
          <td style="padding:12px 16px;">
            <a href="<?= APP_URL ?>/tasks/<?= (int)$ext['task_id'] ?>"
               style="color:#58A6FF;text-decoration:none;font-size:.875rem;font-weight:500;">
              <?= e($ext['task_title'] ?? '') ?>
            </a>
            <?php if (!empty($ext['project_name'])): ?>
            <div style="font-size:.75rem;color:#484F58;margin-top:2px;"><?= e($ext['project_name']) ?></div>
            <?php endif; ?>
          </td>
          <td style="padding:12px 16px;font-size:.875rem;">
            <div style="color:#C9D1D9;"><?= e($ext['original_due_date']) ?> &rarr; <?= e($ext['requested_due_date']) ?></div>
            <div style="font-size:.75rem;color:#484F58;">+<?= (int)$ext['extension_days'] ?> day<?= (int)$ext['extension_days'] !== 1 ? 's' : '' ?></div>
          </td>
          <td style="padding:12px 16px;">
            <span style="display:inline-block;padding:2px 10px;border-radius:9999px;font-size:.75rem;font-weight:600;background:<?= $sbg ?>;color:<?= $sc ?>;">
              <?= $statusLabel ?>
            </span>
            <?php if (!empty($ext['reviewer_name']) && in_array($ext['status'], ['approved', 'rejected'])): ?>
            <div style="font-size:.7rem;color:#484F58;margin-top:2px;">by <?= e($ext['reviewer_name']) ?></div>
            <?php endif; ?>
          </td>
          <td style="padding:12px 16px;font-size:.75rem;color:#484F58;">
            <?= e(substr($ext['created_at'], 0, 10)) ?>
          </td>
        </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <?php endif; ?>
</div>
<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
