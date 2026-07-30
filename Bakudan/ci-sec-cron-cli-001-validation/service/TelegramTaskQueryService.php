<?php
/**
 * TelegramTaskQueryService — answer "When is X due?" type questions.
 *
 * Search priority (per spec §11):
 *  1. Exact title match
 *  2. Store match + keyword match
 *  3. Active / upcoming tasks preferred
 *  4. Nearest future deadline preferred
 *  5. Completed/cancelled excluded unless asked
 */
class TelegramTaskQueryService {

    /**
     * Find the best matching task for a natural-language query.
     *
     * @param int         $userId       Dashboard user ID (scope to this user)
     * @param bool        $isPriv       Is admin/manager (can see all tasks)
     * @param array       $parsed       Parsed result from TelegramTaskParserService
     * @return array|null               Task row or null
     */
    public function findBestMatch(int $userId, bool $isPriv, array $parsed): ?array {
        $db          = Database::getInstance();
        $today       = function_exists('app_today') ? app_today() : date('Y-m-d');
        $storeHint   = $parsed['store_hint']  ?? null;
        $queryTerms  = $parsed['query_terms'] ?? [];
        $projectHint = $parsed['project_hint'] ?? null;

        // Build a keyword LIKE condition from query terms
        $keywordClauses = [];
        $params         = [];

        foreach ($queryTerms as $term) {
            $keywordClauses[] = "t.title LIKE ?";
            $params[]         = '%' . $term . '%';
        }
        if ($storeHint) {
            $keywordClauses[] = "s.name LIKE ?";
            $params[]         = '%' . $storeHint . '%';
        }
        if ($projectHint && $projectHint !== 'General') {
            $keywordClauses[] = "p.name LIKE ?";
            $params[]         = '%' . $projectHint . '%';
        }

        $whereKeywords = $keywordClauses
            ? '(' . implode(' OR ', $keywordClauses) . ')'
            : '1=1';

        // Scope: user's own tasks unless admin/manager
        $scopeClause = $isPriv ? '1=1' : '(t.assignee_id = ? OR t.created_by = ?)';
        if (!$isPriv) { $params[] = $userId; $params[] = $userId; }

        // Search: upcoming or recent, not completed
        $rows = $db->fetchAll(
            "SELECT t.id, t.title, t.due_date, t.status,
                    p.name AS project_name,
                    GROUP_CONCAT(DISTINCT s.name ORDER BY s.name SEPARATOR ', ') AS store_names
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             LEFT JOIN task_stores ts ON t.id = ts.task_id
             LEFT JOIN stores s ON ts.store_id = s.id
             WHERE t.is_completed = 0
               AND t.status NOT IN ('done', 'cancelled')
               AND {$whereKeywords}
               AND {$scopeClause}
             GROUP BY t.id
             ORDER BY
               CASE WHEN t.due_date >= ? THEN 0 ELSE 1 END,
               ABS(DATEDIFF(t.due_date, ?)),
               t.due_date ASC
             LIMIT 5",
            array_merge($params, [$today, $today])
        );

        if (empty($rows)) return null;

        // Return the single best match
        return $rows[0];
    }

    /**
     * Format a task query result as a Telegram message.
     */
    public function formatQueryResponse(?array $task, string $queryText): string {
        if (!$task) {
            return "I couldn't find a relevant task for: <i>" . htmlspecialchars($queryText) . "</i>\n\nMake sure the task exists and is assigned to you.";
        }

        $due = $task['due_date']
            ? (new DateTime($task['due_date']))->format('M j, Y')
            : 'no due date set';

        $msg = "<b>" . htmlspecialchars($task['title']) . "</b> is due on <b>{$due}</b>.";

        if (!empty($task['store_names'])) {
            $msg .= "\nStore: " . htmlspecialchars($task['store_names']);
        }
        if (!empty($task['project_name'])) {
            $msg .= "\nProject: " . htmlspecialchars($task['project_name']);
        }

        return $msg;
    }
}
