<?php
/**
 * MorningBriefService - AI Morning Brief
 * Generates daily summary for managers/CEO
 */
class MorningBriefService
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    public function generateBrief(int $userId): array
    {
        $today = DateService::today();
        $tomorrow = DateService::addDays($today, 1);
        $threeDays = DateService::addDays($today, 3);

        // Tasks due today
        $tasksDueToday = $this->db->fetchAll(
            "SELECT t.id, t.title, t.priority, t.status, p.name as project_name, u.name as assignee_name
             FROM tasks t LEFT JOIN projects p ON t.project_id = p.id LEFT JOIN users u ON t.assignee_id = u.id
             WHERE t.due_date = ? AND t.is_completed = 0 ORDER BY t.priority DESC LIMIT 20", [$today]
        );

        // Overdue tasks
        $overdueTasks = $this->db->fetchAll(
            "SELECT t.id, t.title, t.priority, t.due_date, u.name as assignee_name
             FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id
             WHERE t.due_date < ? AND t.is_completed = 0 ORDER BY t.due_date ASC LIMIT 15", [$today]
        );

        // Upcoming (next 3 days)
        $upcoming = $this->db->fetchAll(
            "SELECT t.id, t.title, t.due_date, t.priority FROM tasks t
             WHERE t.due_date BETWEEN ? AND ? AND t.is_completed = 0 ORDER BY t.due_date ASC LIMIT 10", [$tomorrow, $threeDays]
        );

        // Open incidents
        $incidents = $this->db->fetchAll(
            "SELECT id, title, severity, status FROM incidents WHERE status NOT IN ('resolved','closed','cancelled') ORDER BY FIELD(severity,'critical','high','medium','low') LIMIT 5"
        );

        // Bills due soon
        $billsDue = $this->db->fetchAll(
            "SELECT id, vendor, amount, due_date FROM bills WHERE status IN ('pending','overdue') AND due_date <= ? ORDER BY due_date ASC LIMIT 5", [$threeDays]
        );

        // Team stats
        $teamStats = $this->db->fetch(
            "SELECT COUNT(DISTINCT assignee_id) as active_members,
                    SUM(CASE WHEN is_completed = 1 AND updated_at >= ? THEN 1 ELSE 0 END) as completed_today
             FROM tasks WHERE assignee_id IS NOT NULL", [$today]
        );

        return [
            'date' => $today,
            'generated_at' => date('Y-m-d H:i:s'),
            'overview' => [
                'tasks_due_today' => count($tasksDueToday),
                'overdue_count' => count($overdueTasks),
                'upcoming_3days' => count($upcoming),
                'open_incidents' => count($incidents),
                'bills_due' => count($billsDue),
                'active_members' => (int)($teamStats['active_members'] ?? 0),
                'completed_today' => (int)($teamStats['completed_today'] ?? 0),
            ],
            'tasks' => [
                'due_today' => $tasksDueToday,
                'overdue' => $overdueTasks,
                'upcoming' => $upcoming,
            ],
            'incidents' => $incidents,
            'bills' => $billsDue,
            'highlights' => $this->generateHighlights($tasksDueToday, $overdueTasks, $incidents),
        ];
    }

    public function sendBrief(int $userId, array $brief): void
    {
        $summary = sprintf(
            "Morning Brief (%s): %d tasks today, %d overdue, %d incidents open",
            $brief['date'], $brief['overview']['tasks_due_today'],
            $brief['overview']['overdue_count'], $brief['overview']['open_incidents']
        );

        try {
            (new Notification())->create([
                'user_id' => $userId,
                'type' => 'morning_brief',
                'title' => 'Morning Brief - ' . date('M d', strtotime($brief['date'])),
                'message' => $summary,
                'data' => json_encode($brief['overview']),
            ]);
        } catch (\Throwable $e) {
            error_log("[MorningBrief] Failed to send: " . $e->getMessage());
        }
    }

    public function getBriefStats(): array
    {
        $today = DateService::today();
        return [
            'total_tasks_today' => (int)($this->db->fetch("SELECT COUNT(*) as cnt FROM tasks WHERE due_date = ? AND is_completed = 0", [$today])['cnt'] ?? 0),
            'total_overdue' => (int)($this->db->fetch("SELECT COUNT(*) as cnt FROM tasks WHERE due_date < ? AND is_completed = 0", [$today])['cnt'] ?? 0),
            'total_incidents' => (int)($this->db->fetch("SELECT COUNT(*) as cnt FROM incidents WHERE status NOT IN ('resolved','closed','cancelled')")['cnt'] ?? 0),
        ];
    }

    private function generateHighlights(array $todayTasks, array $overdue, array $incidents): array
    {
        $highlights = [];
        if (count($overdue) > 5) $highlights[] = '⚠️ ' . count($overdue) . ' overdue tasks need attention';
        $critical = array_filter($incidents, fn($i) => $i['severity'] === 'critical');
        if (!empty($critical)) $highlights[] = '🚨 ' . count($critical) . ' critical incident(s) open';
        $urgentToday = array_filter($todayTasks, fn($t) => $t['priority'] === 'urgent');
        if (!empty($urgentToday)) $highlights[] = '🔴 ' . count($urgentToday) . ' urgent task(s) due today';
        if (empty($highlights)) $highlights[] = '✅ Looking good! No critical items.';
        return $highlights;
    }
}
