<?php
class EmailTemplateService {

    // ── Shared layout helpers ──────────────────────────────────────────────────

    private function baseUrl(): string {
        return defined('APP_URL') ? rtrim(APP_URL, '/') : '';
    }

    private function header(string $title): string {
        return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{$title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;padding:32px 16px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background-color:#dc2626;padding:24px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">TaskFlow</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
HTML;
    }

    private function footer(): string {
        $url = $this->baseUrl();
        $settingsUrl = $url . '/settings';
        return <<<HTML
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#6b7280;font-size:12px;text-align:center;">
              You are receiving this email because you have email notifications enabled in TaskFlow.<br>
              <a href="{$settingsUrl}" style="color:#dc2626;text-decoration:none;">Manage preferences</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
HTML;
    }

    private function priorityBadge(string $priority): string {
        $colors = [
            'urgent' => '#dc2626',
            'high'   => '#f97316',
            'medium' => '#eab308',
            'low'    => '#22c55e',
        ];
        $color = $colors[$priority] ?? '#6b7280';
        $label = ucfirst($priority);
        return "<span style=\"display:inline-block;padding:2px 8px;border-radius:9999px;background-color:{$color};color:#ffffff;font-size:11px;font-weight:600;text-transform:uppercase;\">{$label}</span>";
    }

    // ── renderTaskAssigned ─────────────────────────────────────────────────────

    /**
     * Render the "new task assigned" email.
     *
     * @param array $task  Task row (must include id, title, project_name, store_names, due_date, priority, description)
     * @param array $user  Recipient user row
     * @return array{subject: string, html: string}
     */
    public function renderTaskAssigned(array $task, array $user): array {
        $subject = "New Task Assigned: {$task['title']}";
        $baseUrl = $this->baseUrl();
        $taskUrl = $baseUrl . '/tasks/' . (int)$task['id'];

        $projectName = htmlspecialchars($task['project_name'] ?? 'General', ENT_QUOTES, 'UTF-8');
        $storeNames  = htmlspecialchars($task['store_names']  ?? 'General', ENT_QUOTES, 'UTF-8');
        $title       = htmlspecialchars($task['title']        ?? '', ENT_QUOTES, 'UTF-8');
        $userName    = htmlspecialchars($user['name']         ?? 'there', ENT_QUOTES, 'UTF-8');

        $deadline = '—';
        if (!empty($task['due_date'])) {
            $ts = strtotime($task['due_date']);
            if ($ts) $deadline = date('M j, Y', $ts);
        }

        $rawDesc    = $task['description'] ?? '';
        $truncDesc  = mb_strlen($rawDesc) > 500 ? mb_substr($rawDesc, 0, 500) . '…' : $rawDesc;
        $description = htmlspecialchars($truncDesc, ENT_QUOTES, 'UTF-8');

        $priorityBadge = $this->priorityBadge($task['priority'] ?? 'medium');

        $html  = $this->header($subject);
        $html .= <<<HTML
            <h2 style="margin:0 0 8px 0;color:#111827;font-size:20px;font-weight:700;">You have a new task</h2>
            <p style="margin:0 0 24px 0;color:#6b7280;font-size:14px;">Hi {$userName}, a task has been assigned to you.</p>

            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:20px;margin-bottom:24px;">
              <h3 style="margin:0 0 16px 0;color:#111827;font-size:16px;font-weight:600;">{$title}</h3>
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding:4px 0;width:110px;color:#6b7280;font-size:13px;vertical-align:top;">Project</td>
                  <td style="padding:4px 0;color:#111827;font-size:13px;font-weight:500;">{$projectName}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#6b7280;font-size:13px;vertical-align:top;">Store(s)</td>
                  <td style="padding:4px 0;color:#111827;font-size:13px;">{$storeNames}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#6b7280;font-size:13px;vertical-align:top;">Deadline</td>
                  <td style="padding:4px 0;color:#111827;font-size:13px;font-weight:500;">{$deadline}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#6b7280;font-size:13px;vertical-align:top;">Priority</td>
                  <td style="padding:4px 0;">{$priorityBadge}</td>
                </tr>
HTML;

        if ($description !== '') {
            $html .= <<<HTML
                <tr>
                  <td style="padding:12px 0 4px 0;color:#6b7280;font-size:13px;vertical-align:top;" colspan="2">Description</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:0 0 4px 0;color:#374151;font-size:13px;line-height:1.5;">{$description}</td>
                </tr>
HTML;
        }

        $html .= <<<HTML
              </table>
            </div>

            <div style="text-align:center;margin-bottom:8px;">
              <a href="{$taskUrl}"
                 style="display:inline-block;background-color:#dc2626;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">
                View Task
              </a>
            </div>
HTML;

        $html .= $this->footer();
        return ['subject' => $subject, 'html' => $html];
    }

    // ── renderDueTodaySummary ──────────────────────────────────────────────────

    /**
     * Render the "tasks due today" summary email.
     *
     * @param array $tasks  Array of task rows with project_name, store_names, priority
     * @param array $user   Recipient user row
     * @return array{subject: string, html: string}
     */
    public function renderDueTodaySummary(array $tasks, array $user): array {
        $count   = count($tasks);
        $subject = "Tasks Due Today ({$count})";
        $baseUrl = $this->baseUrl();
        $userName = htmlspecialchars($user['name'] ?? 'there', ENT_QUOTES, 'UTF-8');

        $html  = $this->header($subject);
        $html .= <<<HTML
            <h2 style="margin:0 0 8px 0;color:#111827;font-size:20px;font-weight:700;">Tasks Due Today</h2>
            <p style="margin:0 0 24px 0;color:#6b7280;font-size:14px;">Hi {$userName}, you have <strong>{$count}</strong> task(s) due today. Stay on top of it!</p>
HTML;

        foreach ($tasks as $task) {
            $taskTitle   = htmlspecialchars($task['title']        ?? '', ENT_QUOTES, 'UTF-8');
            $projectName = htmlspecialchars($task['project_name'] ?? 'General', ENT_QUOTES, 'UTF-8');
            $storeNames  = htmlspecialchars($task['store_names']  ?? 'General', ENT_QUOTES, 'UTF-8');
            $priorityBadge = $this->priorityBadge($task['priority'] ?? 'medium');
            $taskUrl     = $baseUrl . '/tasks/' . (int)$task['id'];

            $html .= <<<HTML
            <div style="border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin-bottom:12px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align:top;">
                    <a href="{$taskUrl}" style="color:#dc2626;text-decoration:none;font-size:15px;font-weight:600;">{$taskTitle}</a>
                    <div style="margin-top:6px;color:#6b7280;font-size:12px;">{$projectName} &bull; {$storeNames}</div>
                  </td>
                  <td style="vertical-align:top;text-align:right;white-space:nowrap;padding-left:12px;">
                    {$priorityBadge}
                  </td>
                </tr>
              </table>
            </div>
HTML;
        }

        $myTasksUrl = $baseUrl . '/my-tasks';
        $html .= <<<HTML
            <div style="text-align:center;margin-top:24px;">
              <a href="{$myTasksUrl}"
                 style="display:inline-block;background-color:#dc2626;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">
                View All My Tasks
              </a>
            </div>
HTML;

        $html .= $this->footer();
        return ['subject' => $subject, 'html' => $html];
    }

    // ── renderOverdueEscalation ────────────────────────────────────────────────

    /**
     * Render the overdue escalation email.
     *
     * @param array  $groupedTasks  [ ['assignee_name'=>..., 'tasks'=>[...]], ... ]
     *                              Each task must have: title, project_name, store_names, days_overdue, priority, id
     * @param array  $recipient     The recipient user row (name, email)
     * @param string $level         'user' | 'manager' | 'admin'
     * @return array{subject: string, html: string}
     */
    public function renderOverdueEscalation(array $groupedTasks, array $recipient, string $level): array {
        $subject  = '⚠️ Overdue Task Alert';
        $baseUrl  = $this->baseUrl();
        $userName = htmlspecialchars($recipient['name'] ?? 'there', ENT_QUOTES, 'UTF-8');

        $introMap = [
            'user'    => 'The following tasks assigned to you are overdue. Please take action immediately.',
            'manager' => 'The following overdue tasks in your team require your attention.',
            'admin'   => 'ADMIN ALERT: The following tasks are overdue and require escalation.',
        ];
        $intro = htmlspecialchars($introMap[$level] ?? $introMap['user'], ENT_QUOTES, 'UTF-8');

        $html  = $this->header('Overdue Task Alert');
        $html .= <<<HTML
            <h2 style="margin:0 0 8px 0;color:#dc2626;font-size:20px;font-weight:700;">⚠️ Overdue Task Alert</h2>
            <p style="margin:0 0 24px 0;color:#6b7280;font-size:14px;">Hi {$userName}, {$intro}</p>
HTML;

        foreach ($groupedTasks as $group) {
            $assigneeName = htmlspecialchars($group['assignee_name'] ?? 'Unknown', ENT_QUOTES, 'UTF-8');

            if ($level !== 'user') {
                $html .= <<<HTML
            <h3 style="margin:0 0 12px 0;color:#374151;font-size:14px;font-weight:600;border-bottom:1px solid #e5e7eb;padding-bottom:8px;">
              Assignee: {$assigneeName}
            </h3>
HTML;
            }

            foreach ($group['tasks'] as $task) {
                $taskTitle   = htmlspecialchars($task['title']        ?? '', ENT_QUOTES, 'UTF-8');
                $projectName = htmlspecialchars($task['project_name'] ?? 'General', ENT_QUOTES, 'UTF-8');
                $storeNames  = htmlspecialchars($task['store_names']  ?? 'General', ENT_QUOTES, 'UTF-8');
                $daysOverdue = (int)($task['days_overdue'] ?? 0);
                $priorityBadge = $this->priorityBadge($task['priority'] ?? 'medium');
                $taskUrl     = $baseUrl . '/tasks/' . (int)$task['id'];

                $overdueColor = $daysOverdue >= 7 ? '#dc2626' : '#f97316';
                $overdueLabel = $daysOverdue === 1 ? '1 day overdue' : "{$daysOverdue} days overdue";

                $html .= <<<HTML
            <div style="border:1px solid #fca5a5;border-radius:6px;padding:14px;margin-bottom:10px;background:#fff7f7;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align:top;">
                    <a href="{$taskUrl}" style="color:#dc2626;text-decoration:none;font-size:14px;font-weight:600;">{$taskTitle}</a>
                    <div style="margin-top:5px;color:#6b7280;font-size:12px;">{$projectName} &bull; {$storeNames}</div>
                    <div style="margin-top:4px;">
                      {$priorityBadge}
                      <span style="display:inline-block;margin-left:6px;color:{$overdueColor};font-size:12px;font-weight:600;">{$overdueLabel}</span>
                    </div>
                  </td>
                </tr>
              </table>
            </div>
HTML;
            }
        }

        $overviewUrl = $baseUrl . '/overview';
        $html .= <<<HTML
            <div style="text-align:center;margin-top:24px;">
              <a href="{$overviewUrl}"
                 style="display:inline-block;background-color:#dc2626;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">
                View Overview
              </a>
            </div>
HTML;

        $html .= $this->footer();
        return ['subject' => $subject, 'html' => $html];
    }
}
