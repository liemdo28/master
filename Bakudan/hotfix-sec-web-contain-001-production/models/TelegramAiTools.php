<?php
/**
 * TelegramAiTools — Whitelisted tool definitions for F4 Q&A
 *
 * Principle: AI NEVER touches the DB directly. Every tool call goes through
 * this class, which applies PHP-level permission checks before returning data.
 *
 * Tool schema follows Anthropic/Claude format; AiRouter normalises for OpenAI.
 *
 * Usage (inside TelegramController):
 *   $tools = TelegramAiTools::definitions();
 *   // ... call AI with tools ...
 *   $result = TelegramAiTools::execute($toolName, $toolInput, $userId, $isAdmin);
 */
class TelegramAiTools {
    private static ?Database $db = null;

    private static function db(): Database {
        if (self::$db === null) self::$db = Database::getInstance();
        return self::$db;
    }

    // ── Tool schema definitions (sent to AI) ─────────────────────────────────

    public static function definitions(): array {
        return [
            [
                'name'        => 'search_tasks',
                'description' => 'Tìm kiếm task của user theo trạng thái, ưu tiên. Trả về danh sách task với title, deadline, priority, trạng thái.',
                'input_schema'=> [
                    'type'       => 'object',
                    'properties' => [
                        'status' => [
                            'type' => 'string',
                            'enum' => ['overdue','today','upcoming','completed','in_progress','all'],
                            'description' => 'Lọc theo trạng thái deadline/tiến độ',
                        ],
                        'priority' => [
                            'type' => 'string',
                            'enum' => ['urgent','high','medium','low','any'],
                            'description' => 'Lọc theo mức ưu tiên',
                        ],
                        'limit' => [
                            'type'        => 'integer',
                            'description' => 'Số task tối đa trả về (mặc định 10, tối đa 20)',
                        ],
                        'target_user_id' => [
                            'type'        => 'integer',
                            'description' => 'ID user muốn xem (chỉ admin mới dùng được, member chỉ xem được của mình)',
                        ],
                    ],
                ],
            ],
            [
                'name'        => 'get_task_detail',
                'description' => 'Xem chi tiết một task: mô tả, assignee, deadline, comments gần nhất.',
                'input_schema'=> [
                    'type'       => 'object',
                    'required'   => ['task_id'],
                    'properties' => [
                        'task_id' => ['type' => 'integer', 'description' => 'ID của task'],
                    ],
                ],
            ],
            [
                'name'        => 'get_user_stats',
                'description' => 'Thống kê hiệu suất của một user: số task hoàn thành, đang làm, trễ deadline, tỷ lệ hoàn thành trong 30 ngày.',
                'input_schema'=> [
                    'type'       => 'object',
                    'properties' => [
                        'target_user_id' => [
                            'type'        => 'integer',
                            'description' => 'ID user (để trống = chính mình; admin có thể xem người khác)',
                        ],
                    ],
                ],
            ],
            [
                'name'        => 'list_team_members',
                'description' => 'Liệt kê danh sách thành viên trong team (tên, email, role). Chỉ admin/manager được dùng.',
                'input_schema'=> ['type' => 'object', 'properties' => []],
            ],
            [
                'name'        => 'get_user_penalty_summary',
                'description' => 'Xem tổng tiền phạt deadline của một user: số task trễ, mức phạt, tổng tiền.',
                'input_schema'=> [
                    'type'       => 'object',
                    'properties' => [
                        'target_user_id' => [
                            'type'        => 'integer',
                            'description' => 'ID user (để trống = chính mình; admin thấy tất cả, member chỉ thấy mình)',
                        ],
                    ],
                ],
            ],
        ];
    }

    // ── Tool executor (PHP permission gate) ───────────────────────────────────

    /**
     * @param string $tool    Tool name from AI response
     * @param array  $input   Tool input parameters
     * @param int    $userId  Calling user's DB ID
     * @param bool   $isAdmin Whether the calling user has admin role
     * @return array  Tool result to feed back to AI
     */
    public static function execute(string $tool, array $input, int $userId, bool $isAdmin): array {
        try {
            return match ($tool) {
                'search_tasks'           => self::searchTasks($input, $userId, $isAdmin),
                'get_task_detail'        => self::getTaskDetail($input, $userId, $isAdmin),
                'get_user_stats'         => self::getUserStats($input, $userId, $isAdmin),
                'list_team_members'      => self::listTeamMembers($userId, $isAdmin),
                'get_user_penalty_summary' => self::getUserPenaltySummary($input, $userId, $isAdmin),
                default                  => ['error' => "Unknown tool: {$tool}"],
            };
        } catch (\Throwable $e) {
            return ['error' => $e->getMessage()];
        }
    }

    // ── Individual tool implementations ──────────────────────────────────────

    private static function searchTasks(array $input, int $userId, bool $isAdmin): array {
        $targetId = self::resolveTargetUser($input['target_user_id'] ?? null, $userId, $isAdmin);
        $status   = $input['status'] ?? 'all';
        $priority = $input['priority'] ?? 'any';
        $limit    = min((int)($input['limit'] ?? 10), 20);
        $today    = (new DateTime('now', new DateTimeZone(APP_TIMEZONE)))->format('Y-m-d');

        $where  = ['t.assignee_id = ?'];
        $params = [$targetId];

        switch ($status) {
            case 'overdue':
                $where[] = 't.is_completed = 0';
                $where[] = 't.due_date < ?';
                $params[] = $today;
                break;
            case 'today':
                $where[] = 't.is_completed = 0';
                $where[] = 't.due_date = ?';
                $params[] = $today;
                break;
            case 'upcoming':
                $where[] = 't.is_completed = 0';
                $where[] = 't.due_date > ?';
                $params[] = $today;
                break;
            case 'completed':
                $where[] = 't.is_completed = 1';
                break;
            case 'in_progress':
                $where[] = "t.status = 'in_progress'";
                $where[] = 't.is_completed = 0';
                break;
        }

        if ($priority !== 'any') {
            $where[]  = 't.priority = ?';
            $params[] = $priority;
        }

        $sql = "SELECT t.id, t.title, t.due_date, t.priority, t.status, t.is_completed,
                       p.name AS project_name
                FROM tasks t
                LEFT JOIN projects p ON p.id = t.project_id
                WHERE " . implode(' AND ', $where) . "
                ORDER BY
                    CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
                    t.due_date ASC,
                    FIELD(t.priority,'urgent','high','medium','low')
                LIMIT ?";
        $params[] = $limit;

        $rows = self::db()->fetchAll($sql, $params);
        return ['tasks' => $rows, 'count' => count($rows), 'for_user_id' => $targetId];
    }

    private static function getTaskDetail(array $input, int $userId, bool $isAdmin): array {
        $taskId = (int)($input['task_id'] ?? 0);
        if ($taskId <= 0) return ['error' => 'task_id required'];

        $task = self::db()->fetch(
            "SELECT t.*, p.name AS project_name, u.name AS assignee_name
             FROM tasks t
             LEFT JOIN projects p ON p.id = t.project_id
             LEFT JOIN users u ON u.id = t.assignee_id
             WHERE t.id = ?",
            [$taskId]
        );
        if (!$task) return ['error' => 'Task not found'];

        // Permission: member can only see tasks assigned to them or created by them
        if (!$isAdmin && (int)($task['assignee_id'] ?? 0) !== $userId && (int)($task['created_by'] ?? 0) !== $userId) {
            return ['error' => 'Permission denied'];
        }

        $comments = self::db()->fetchAll(
            "SELECT c.content, u.name AS author, c.created_at
             FROM comments c LEFT JOIN users u ON u.id = c.user_id
             WHERE c.task_id = ? ORDER BY c.created_at DESC LIMIT 3",
            [$taskId]
        );

        return ['task' => $task, 'recent_comments' => $comments];
    }

    private static function getUserStats(array $input, int $userId, bool $isAdmin): array {
        $targetId = self::resolveTargetUser($input['target_user_id'] ?? null, $userId, $isAdmin);
        $today    = (new DateTime('now', new DateTimeZone(APP_TIMEZONE)))->format('Y-m-d');
        $since    = date('Y-m-d', strtotime($today . ' -30 days'));

        $stats = self::db()->fetch(
            "SELECT
                SUM(CASE WHEN is_completed=0 AND due_date < ? THEN 1 ELSE 0 END) AS overdue,
                SUM(CASE WHEN is_completed=0 AND due_date = ? THEN 1 ELSE 0 END) AS today,
                SUM(CASE WHEN is_completed=0 AND (due_date IS NULL OR due_date > ?) THEN 1 ELSE 0 END) AS upcoming,
                SUM(CASE WHEN is_completed=1 AND completed_at >= ? THEN 1 ELSE 0 END) AS completed_30d,
                COUNT(*) AS total
             FROM tasks WHERE assignee_id = ?",
            [$today, $today, $today, $since, $targetId]
        );

        return ['stats' => $stats, 'for_user_id' => $targetId, 'period_days' => 30];
    }

    private static function listTeamMembers(int $userId, bool $isAdmin): array {
        if (!$isAdmin) return ['error' => 'Admin only'];
        $members = self::db()->fetchAll(
            "SELECT id, name, email, role FROM users WHERE is_active = 1 ORDER BY name"
        );
        return ['members' => $members, 'count' => count($members)];
    }

    private static function getUserPenaltySummary(array $input, int $userId, bool $isAdmin): array {
        $targetId = self::resolveTargetUser($input['target_user_id'] ?? null, $userId, $isAdmin);

        if (!class_exists('Penalty')) return ['error' => 'Penalty feature not available'];
        $penalty = new Penalty();

        if (!$penalty->isUserPenalized($targetId)) {
            return ['penalized' => false, 'for_user_id' => $targetId];
        }

        $detail = $penalty->getUserDetail($targetId);
        return [
            'penalized'       => true,
            'total_amount'    => $detail['total_amount'],
            'late_count'      => $detail['late_count'],
            'amount_per_task' => $detail['config']['amount_per_late_task'],
            'for_user_id'     => $targetId,
        ];
    }

    // ── Permission helper ─────────────────────────────────────────────────────

    private static function resolveTargetUser(?int $requestedId, int $callerId, bool $isAdmin): int {
        if ($requestedId === null || $requestedId === 0) return $callerId;
        if ($requestedId === $callerId) return $callerId;
        if (!$isAdmin) {
            // Non-admin tried to see someone else's data — silently return their own
            return $callerId;
        }
        return $requestedId;
    }
}
