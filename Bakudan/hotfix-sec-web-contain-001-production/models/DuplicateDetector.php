<?php
/**
 * DuplicateDetector — hash-based duplicate detection for bills and tasks.
 * All public methods are static; no DB write side-effects (query-only).
 */
class DuplicateDetector
{
    // ── Hash computation ──────────────────────────────────────────────────────

    public static function billHash(
        string $title,
        int    $store_id,
        string $due_date,
        float  $amount,
        string $vendor   = '',
        string $category = ''
    ): string {
        return md5(implode('|', [
            self::normalizeBillTitle($title, $vendor, $category),
            $store_id,
            $due_date,                     // Y-m-d
            (int) round($amount),
            self::normalizeVendor($vendor ?: $title),
            strtolower(trim($category)),
        ]));
    }

    public static function taskHash(
        string $title,
        int    $store_id,
        string $due_date,
        int    $assignee_id = 0,
        string $category    = ''
    ): string {
        return md5(implode('|', [
            strtolower(trim($title)),
            $store_id,
            $due_date,
            $assignee_id,
            strtolower(trim($category)),
        ]));
    }

    // ── Pre-create duplicate checks ───────────────────────────────────────────

    /**
     * Check if a bill already exists with the same hash.
     * @param  array $data  Keys: title, store_id, due_date, amount, vendor, category
     * @return array|null   Existing bill row + store_name, or null if no duplicate
     */
    public static function checkBillDuplicate(array $data): ?array
    {
        $db = Database::getInstance();
        if (!$db->tableExists('bills')) return null;

        $hash = self::billHash(
            $data['title']    ?? '',
            (int)($data['store_id']  ?? 0),
            $data['due_date'] ?? '',
            (float)($data['amount']  ?? 0),
            $data['vendor']   ?? '',
            $data['category'] ?? ''
        );

        $hasArchived = $db->columnExists('bills', 'is_archived');
        $archiveClause = $hasArchived ? "AND (b.is_archived = 0 OR b.is_archived IS NULL)" : "";

        $row = null;

        // First try: exact hash match
        if ($db->columnExists('bills', 'duplicate_hash')) {
            $row = $db->fetch(
                "SELECT b.*, s.name AS store_name
                 FROM bills b
                 LEFT JOIN stores s ON s.id = b.store_id
                 WHERE b.duplicate_hash = ?
                 {$archiveClause}
                 ORDER BY b.id ASC LIMIT 1",
                [$hash]
            );
        }

        // Fallback: same store/date candidates with normalized scoring. This catches
        // labels like "Raw PGE" vs "Raw Stockton PGE" for the same obligation.
        if (!$row) {
            $candidates = $db->fetchAll(
                "SELECT b.*, s.name AS store_name
                 FROM bills b
                 LEFT JOIN stores s ON s.id = b.store_id
                 WHERE b.store_id = ?
                   AND DATE(b.due_date) = ?
                 {$archiveClause}
                 ORDER BY b.id ASC LIMIT 20",
                [(int)($data['store_id'] ?? 0), $data['due_date'] ?? '']
            );
            foreach ($candidates as $candidate) {
                if (self::scoreMatch($candidate, $data) >= 70) {
                    $row = $candidate;
                    break;
                }
            }
        }

        return $row ?: null;
    }

    /**
     * Check if a task already exists with the same hash.
     * @param  array $data  Keys: title, store_id, due_date, assignee_id, category
     * @return array|null   Existing task row, or null
     */
    public static function checkTaskDuplicate(array $data): ?array
    {
        $db = Database::getInstance();
        if (!$db->tableExists('tasks')) return null;

        $hash = self::taskHash(
            $data['title']       ?? '',
            (int)($data['store_id']     ?? 0),
            $data['due_date']    ?? '',
            (int)($data['assignee_id']  ?? 0),
            $data['category']    ?? ''
        );

        $hasArchived = $db->columnExists('tasks', 'archived_duplicate');
        $archiveClause = $hasArchived ? "AND (t.archived_duplicate = 0 OR t.archived_duplicate IS NULL)" : "";

        $row = null;

        if ($db->columnExists('tasks', 'duplicate_hash')) {
            $row = $db->fetch(
                "SELECT t.*, s.name AS store_name, u.name AS assignee_name
                 FROM tasks t
                 LEFT JOIN projects p ON p.id = t.project_id
                 LEFT JOIN stores s ON s.id = p.store_id
                 LEFT JOIN users u ON u.id = t.assignee_id
                 WHERE t.duplicate_hash = ?
                   AND t.is_completed = 0
                 {$archiveClause}
                 ORDER BY t.id ASC LIMIT 1",
                [$hash]
            );
        }

        if (!$row) {
            $row = $db->fetch(
                "SELECT t.*, s.name AS store_name, u.name AS assignee_name
                 FROM tasks t
                 LEFT JOIN projects p ON p.id = t.project_id
                 LEFT JOIN stores s ON s.id = p.store_id
                 LEFT JOIN users u ON u.id = t.assignee_id
                 WHERE LOWER(t.title) = ?
                   AND t.is_completed = 0
                   AND t.due_date = ?
                 {$archiveClause}
                 ORDER BY t.id ASC LIMIT 1",
                [strtolower(trim($data['title'] ?? '')), $data['due_date'] ?? '']
            );
        }

        return $row ?: null;
    }

    // ── Scoring ───────────────────────────────────────────────────────────────

    /**
     * Score similarity between existing record and a candidate (0–100).
     * Score >= 70 triggers the duplicate modal on the frontend.
     */
    public static function scoreMatch(array $existing, array $candidate): int
    {
        $score = 0;

        // Title match — most important (up to 40 pts)
        $existTitle = self::normalizeBillTitle($existing['title'] ?? '', $existing['vendor'] ?? $existing['vendor_name'] ?? '', $existing['category'] ?? '');
        $candTitle  = self::normalizeBillTitle($candidate['title'] ?? '', $candidate['vendor'] ?? '', $candidate['category'] ?? '');
        if ($existTitle === $candTitle) {
            $score += 40;
        } else {
            similar_text($existTitle, $candTitle, $pct);
            $score += (int) ($pct * 0.40);
        }

        // Store match (20 pts)
        if ((int)($existing['store_id'] ?? 0) === (int)($candidate['store_id'] ?? 0)) {
            $score += 20;
        }

        // Due date match (20 pts)
        $existDue = substr($existing['due_date'] ?? '', 0, 10);
        $candDue  = substr($candidate['due_date'] ?? '', 0, 10);
        if ($existDue && $candDue) {
            if ($existDue === $candDue) {
                $score += 20;
            } elseif (substr($existDue, 0, 7) === substr($candDue, 0, 7)) {
                $score += 10; // same month
            }
        }

        // Amount match (10 pts)
        $existAmt = (float)($existing['amount'] ?? 0);
        $candAmt  = (float)($candidate['amount'] ?? 0);
        if ($existAmt > 0 && $candAmt > 0 && (int)round($existAmt) === (int)round($candAmt)) {
            $score += 10;
        }

        // Vendor match (10 pts)
        $existVendor = self::normalizeVendor($existing['vendor'] ?? $existing['vendor_name'] ?? $existing['title'] ?? '');
        $candVendor  = self::normalizeVendor($candidate['vendor'] ?? $candidate['title'] ?? '');
        if ($existVendor && $candVendor && $existVendor === $candVendor) {
            $score += 10;
        }

        return min(100, $score);
    }

    private static function normalizeBillTitle(string $title, string $vendor = '', string $category = ''): string
    {
        $value = strtolower(trim(html_entity_decode($title . ' ' . $vendor . ' ' . $category, ENT_QUOTES)));
        $value = preg_replace('/[^a-z0-9&]+/', ' ', $value);
        $value = preg_replace('/\b(raw stockton|raw|stockton|bakudan|b1|b2|b3|the rim|stone oak|bandera|modesto|heo holding|ift)\b/', ' ', $value);
        $value = preg_replace('/\s+/', ' ', trim($value));

        if (preg_match('/\b(pg\s*&\s*e|pg\s*e|pge)\b/', $value)) {
            return 'pge';
        }
        if (preg_match('/\bcps\b/', $value)) {
            return 'cps energy';
        }
        if (str_contains($value, 'amtrust')) {
            return 'amtrust';
        }

        return $value;
    }

    private static function normalizeVendor(string $vendor): string
    {
        $value = strtolower(trim(html_entity_decode($vendor, ENT_QUOTES)));
        $value = preg_replace('/[^a-z0-9&]+/', ' ', $value);
        $value = preg_replace('/\s+/', ' ', trim($value));

        if (preg_match('/\b(pg\s*&\s*e|pg\s*e|pge)\b/', $value)) {
            return 'pge';
        }
        if (preg_match('/\bcps\b/', $value)) {
            return 'cps energy';
        }

        return $value;
    }
}
