<?php
/**
 * ComplianceEngine — Filing Calendar, Compliance Risk
 * Compliance items are bills with category='tax' or category='payroll'
 * OR vendor name matching regulatory keywords.
 * Answers: What filings are due? What is overdue? What is the compliance risk score?
 */
class ComplianceEngine
{
    private $db;
    private string $today;

    private const COMPLIANCE_VENDORS    = ['cdtfa','ftb','irs','edd','boe','sec','ca tax','sales tax','payroll tax','state tax','federal'];
    private const COMPLIANCE_CATEGORIES = ['tax','payroll'];

    public function __construct()
    {
        $this->db    = Database::getInstance();
        $this->today = app_today();
    }

    /**
     * Build the WHERE clause fragment + params for compliance items.
     * Matches bills by category OR vendor keyword.
     */
    private function complianceWhere(): array
    {
        $catPlaceholders = implode(',', array_fill(0, count(self::COMPLIANCE_CATEGORIES), '?'));
        $vendorLikes     = implode(' OR ', array_fill(0, count(self::COMPLIANCE_VENDORS), 'LOWER(b.vendor) LIKE ?'));

        $sql = "(b.category IN ($catPlaceholders) OR ($vendorLikes))";

        $params = self::COMPLIANCE_CATEGORIES;
        foreach (self::COMPLIANCE_VENDORS as $kw) {
            $params[] = '%' . $kw . '%';
        }

        return [$sql, $params];
    }

    /**
     * Map days_until value to a risk level string.
     */
    private function riskLevel(int $daysUntil): string
    {
        if ($daysUntil < 0) {
            return 'critical';
        }
        if ($daysUntil === 0) {
            return 'high';
        }
        if ($daysUntil <= 3) {
            return 'high';
        }
        if ($daysUntil <= 7) {
            return 'medium';
        }
        return 'low';
    }

    /**
     * Get all compliance items (upcoming + overdue)
     * Includes overdue compliance bills + upcoming in next 60 days.
     */
    public function getFilingCalendar(): array
    {
        try {
            [$where, $params] = $this->complianceWhere();

            $in60Days = date('Y-m-d', strtotime($this->today . ' +60 days'));

            // Overdue: due_date < today and status != paid, OR status = overdue
            // Upcoming: due_date between today and today+60 and status != paid
            $sql = "SELECT b.id, b.title, b.vendor, b.category, b.due_date,
                           b.status, b.amount, s.name AS store_name
                    FROM bills b
                    JOIN stores s ON s.id = b.store_id
                    WHERE $where
                      AND b.status != 'paid'
                      AND (
                            (b.due_date < ? )
                            OR (b.due_date BETWEEN ? AND ?)
                          )
                    ORDER BY b.due_date ASC";

            $params[] = $this->today;   // for overdue condition
            $params[] = $this->today;   // BETWEEN start
            $params[] = $in60Days;      // BETWEEN end

            $rows   = $this->db->fetchAll($sql, $params);
            $result = [];

            foreach ($rows as $row) {
                $daysUntil = (int)round(
                    (strtotime($row['due_date']) - strtotime($this->today)) / 86400
                );

                $result[] = [
                    'id'         => (int)$row['id'],
                    'title'      => $row['title'],
                    'vendor'     => $row['vendor'] ?? '',
                    'category'   => $row['category'] ?? '',
                    'due_date'   => $row['due_date'],
                    'days_until' => $daysUntil,
                    'status'     => $row['status'],
                    'risk_level' => $this->riskLevel($daysUntil),
                    'store_name' => $row['store_name'],
                    'amount'     => $row['amount'] !== null ? (float)$row['amount'] : null,
                ];
            }

            return $result;
        } catch (Exception $e) {
            return [];
        }
    }

    /**
     * Compliance risk score 0-100 and level.
     * Returns: ['score'=>int, 'level'=>string, 'overdue_count'=>int, 'due_soon_count'=>int]
     */
    public function getComplianceRisk(): array
    {
        try {
            $items       = $this->getFilingCalendar();
            $score       = 0;
            $overdueCount = 0;
            $dueSoonCount = 0;

            foreach ($items as $item) {
                $d = $item['days_until'];

                if ($d < 0) {
                    $score += 25;
                    $overdueCount++;
                } elseif ($d <= 3) {
                    $score += 15;
                    $dueSoonCount++;
                } elseif ($d <= 7) {
                    $score += 8;
                    $dueSoonCount++;
                }
            }

            $score = min(100, $score);
            $level = match(true) {
                $score >= 81 => 'critical',
                $score >= 61 => 'high',
                $score >= 31 => 'medium',
                default      => 'low',
            };

            return [
                'score'        => $score,
                'level'        => $level,
                'overdue_count' => $overdueCount,
                'due_soon_count' => $dueSoonCount,
            ];
        } catch (Exception $e) {
            return ['score' => 0, 'level' => 'low', 'overdue_count' => 0, 'due_soon_count' => 0];
        }
    }

    /**
     * Returns only overdue compliance items.
     */
    public function getOverdueFilings(): array
    {
        try {
            return array_values(array_filter(
                $this->getFilingCalendar(),
                fn($item) => $item['days_until'] < 0
            ));
        } catch (Exception $e) {
            return [];
        }
    }
}
