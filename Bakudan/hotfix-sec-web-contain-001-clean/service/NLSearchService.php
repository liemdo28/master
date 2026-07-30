<?php
/**
 * NLSearchService - Natural Language Search
 * Parses queries with filters and returns ranked results
 */
class NLSearchService
{
    private $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    public function search(string $query, int $userId): array
    {
        $parsed = $this->parseFilters($query);
        $cleanQuery = $parsed['query'];
        $filters = $parsed['filters'];
        $intent = $this->parseIntent($query);

        $results = [
            'query' => $query,
            'clean_query' => $cleanQuery,
            'intent' => $intent,
            'filters' => $filters,
            'tasks' => [],
            'projects' => [],
            'stores' => [],
            'users' => [],
        ];

        if (empty($cleanQuery) && empty($filters)) return $results;

        $like = '%' . $cleanQuery . '%';

        // Tasks
        $taskWhere = ['1=1']; $taskParams = [];
        if ($cleanQuery) { $taskWhere[] = '(t.title LIKE ? OR t.description LIKE ?)'; $taskParams[] = $like; $taskParams[] = $like; }
        if (!empty($filters['priority'])) { $taskWhere[] = 't.priority = ?'; $taskParams[] = $filters['priority']; }
        if (!empty($filters['status'])) { $taskWhere[] = 't.status = ?'; $taskParams[] = $filters['status']; }
        if (!empty($filters['due'])) {
            if ($filters['due'] === 'today') { $taskWhere[] = 't.due_date = CURDATE()'; }
            elseif ($filters['due'] === 'overdue') { $taskWhere[] = 't.due_date < CURDATE() AND t.is_completed = 0'; }
            elseif ($filters['due'] === 'week') { $taskWhere[] = 't.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)'; }
        }
        $taskParams[] = 10;
        $results['tasks'] = $this->db->fetchAll(
            "SELECT t.id, t.title, t.status, t.priority, t.due_date, t.is_completed, p.name as project_name, u.name as assignee_name
             FROM tasks t LEFT JOIN projects p ON t.project_id = p.id LEFT JOIN users u ON t.assignee_id = u.id
             WHERE " . implode(' AND ', $taskWhere) . " ORDER BY t.is_completed ASC, t.due_date ASC LIMIT ?", $taskParams
        );

        // Projects
        if ($cleanQuery) {
            $results['projects'] = $this->db->fetchAll(
                "SELECT id, name, color FROM projects WHERE name LIKE ? ORDER BY name LIMIT 5", [$like]
            );
        }

        // Stores
        if ($cleanQuery && $this->db->tableExists('stores')) {
            $results['stores'] = $this->db->fetchAll(
                "SELECT id, name, color FROM stores WHERE name LIKE ? ORDER BY name LIMIT 5", [$like]
            );
        }

        // Users
        if ($cleanQuery) {
            $results['users'] = $this->db->fetchAll(
                "SELECT id, name, email, role FROM users WHERE is_active = 1 AND (name LIKE ? OR email LIKE ?) ORDER BY name LIMIT 5", [$like, $like]
            );
        }

        // Add relevance scores
        foreach ($results['tasks'] as &$t) {
            $t['relevance'] = $this->calculateRelevance($t['title'], $cleanQuery);
        }
        usort($results['tasks'], fn($a, $b) => $b['relevance'] <=> $a['relevance']);

        return $results;
    }

    public function parseIntent(string $query): array
    {
        $query = strtolower(trim($query));
        $actions = ['create', 'add', 'new', 'update', 'edit', 'change', 'complete', 'done', 'finish', 'delete', 'remove', 'show', 'find', 'list', 'get'];
        $entities = ['task', 'project', 'incident', 'bill', 'store', 'shift', 'employee', 'document'];

        $detectedAction = null;
        $detectedEntity = null;

        foreach ($actions as $action) {
            if (str_starts_with($query, $action) || str_contains($query, " $action ")) {
                $detectedAction = $action;
                break;
            }
        }

        foreach ($entities as $entity) {
            if (str_contains($query, $entity)) {
                $detectedEntity = $entity;
                break;
            }
        }

        return [
            'action' => $detectedAction,
            'entity' => $detectedEntity,
            'is_question' => str_contains($query, '?') || str_starts_with($query, 'how') || str_starts_with($query, 'what') || str_starts_with($query, 'where'),
        ];
    }

    public function highlightMatches(string $text, string $query): string
    {
        if (empty($query)) return htmlspecialchars($text);
        $words = array_filter(explode(' ', $query));
        $escaped = htmlspecialchars($text);
        foreach ($words as $word) {
            $escaped = preg_replace('/(' . preg_quote(htmlspecialchars($word), '/') . ')/i', '<mark>$1</mark>', $escaped);
        }
        return $escaped;
    }

    private function parseFilters(string $query): array
    {
        $filters = [];
        $cleanQuery = $query;

        // Parse store:name
        if (preg_match('/store:(\S+)/i', $query, $m)) {
            $filters['store'] = $m[1];
            $cleanQuery = str_replace($m[0], '', $cleanQuery);
        }
        // Parse user:name
        if (preg_match('/user:(\S+)/i', $query, $m)) {
            $filters['user'] = $m[1];
            $cleanQuery = str_replace($m[0], '', $cleanQuery);
        }
        // Parse priority:high
        if (preg_match('/priority:(low|medium|high|urgent)/i', $query, $m)) {
            $filters['priority'] = strtolower($m[1]);
            $cleanQuery = str_replace($m[0], '', $cleanQuery);
        }
        // Parse status:done
        if (preg_match('/status:(\S+)/i', $query, $m)) {
            $filters['status'] = strtolower($m[1]);
            $cleanQuery = str_replace($m[0], '', $cleanQuery);
        }
        // Parse due:today|overdue|week
        if (preg_match('/due:(today|overdue|week|tomorrow)/i', $query, $m)) {
            $filters['due'] = strtolower($m[1]);
            $cleanQuery = str_replace($m[0], '', $cleanQuery);
        }
        // Parse type:task|project|bill
        if (preg_match('/type:(\S+)/i', $query, $m)) {
            $filters['type'] = strtolower($m[1]);
            $cleanQuery = str_replace($m[0], '', $cleanQuery);
        }

        return ['query' => trim($cleanQuery), 'filters' => $filters];
    }

    private function calculateRelevance(string $title, string $query): float
    {
        if (empty($query)) return 0.5;
        $title = strtolower($title);
        $query = strtolower($query);

        // Exact match
        if ($title === $query) return 1.0;
        // Starts with
        if (str_starts_with($title, $query)) return 0.9;
        // Contains exact phrase
        if (str_contains($title, $query)) return 0.8;
        // Word match
        $words = explode(' ', $query);
        $matched = 0;
        foreach ($words as $w) { if (str_contains($title, $w)) $matched++; }
        return $matched / max(1, count($words)) * 0.7;
    }
}
