<?php
/**
 * FinanceIntelligenceEngine — Cash Timeline, Vendor Intelligence, Payment Risk
 * Answers: What must be paid? When? What is the vendor risk?
 */
class FinanceIntelligenceEngine
{
    private $db;
    private string $today;

    public function __construct()
    {
        $this->db    = Database::getInstance();
        $this->today = app_today();
    }

    /**
     * Cash timeline: how much is due today / next 7 days / this month / overdue
     */
    public function getCashTimeline(): array
    {
        $empty = ['amount' => 0.0, 'count' => 0, 'bills' => []];
        $result = [
            'today'   => $empty,
            'next7'   => $empty,
            'month'   => $empty,
            'overdue' => $empty,
        ];

        try {
            $next7End   = date('Y-m-d', strtotime($this->today . ' +7 days'));
            $monthEnd   = date('Y-m-t', strtotime($this->today));
            $next1Start = date('Y-m-d', strtotime($this->today . ' +1 day'));

            $rows = $this->db->fetchAll(
                "SELECT b.id, b.title, b.vendor, b.amount, b.due_date, b.status,
                        b.category, s.name AS store_name
                 FROM bills b
                 JOIN stores s ON s.id = b.store_id
                 WHERE b.status != 'paid'
                   AND b.due_date >= ?
                   AND b.due_date <= ?",
                [$this->today, $monthEnd]
            );

            $overdueRows = $this->db->fetchAll(
                "SELECT b.id, b.title, b.vendor, b.amount, b.due_date, b.status,
                        b.category, s.name AS store_name
                 FROM bills b
                 JOIN stores s ON s.id = b.store_id
                 WHERE b.status = 'overdue'
                    OR (b.due_date < ? AND b.status = 'pending')",
                [$this->today]
            );

            foreach ($rows as $bill) {
                $amount = (float)($bill['amount'] ?? 0);

                if ($bill['due_date'] === $this->today) {
                    $result['today']['bills'][]  = $bill;
                    $result['today']['amount']  += $amount;
                    $result['today']['count']++;
                    $result['month']['bills'][]  = $bill;
                    $result['month']['amount']  += $amount;
                    $result['month']['count']++;
                } elseif ($bill['due_date'] >= $next1Start && $bill['due_date'] <= $next7End) {
                    $result['next7']['bills'][]  = $bill;
                    $result['next7']['amount']  += $amount;
                    $result['next7']['count']++;
                    $result['month']['bills'][]  = $bill;
                    $result['month']['amount']  += $amount;
                    $result['month']['count']++;
                } else {
                    // beyond next7 but still within month
                    $result['month']['bills'][]  = $bill;
                    $result['month']['amount']  += $amount;
                    $result['month']['count']++;
                }
            }

            foreach ($overdueRows as $bill) {
                $result['overdue']['bills'][]  = $bill;
                $result['overdue']['amount']  += (float)($bill['amount'] ?? 0);
                $result['overdue']['count']++;
            }
        } catch (Exception $e) {
            // return empty structure on error
        }

        return $result;
    }

    /**
     * Payment risk classification — group all unpaid bills by risk level
     */
    public function getPaymentRiskBuckets(): array
    {
        $result = ['critical' => [], 'high' => [], 'medium' => [], 'low' => []];

        try {
            $in3Days = date('Y-m-d', strtotime($this->today . ' +3 days'));

            $rows = $this->db->fetchAll(
                "SELECT b.id, b.title, b.vendor, b.amount, b.due_date, b.status,
                        b.category, s.name AS store_name
                 FROM bills b
                 JOIN stores s ON s.id = b.store_id
                 WHERE b.status != 'paid'
                 ORDER BY b.due_date ASC"
            );

            foreach ($rows as $bill) {
                $due    = $bill['due_date'];
                $status = $bill['status'];

                if ($status === 'overdue' || $due < $this->today) {
                    $result['critical'][] = $bill;
                } elseif ($due === $this->today) {
                    $result['high'][] = $bill;
                } elseif ($due <= $in3Days) {
                    $result['medium'][] = $bill;
                } else {
                    $result['low'][] = $bill;
                }
            }
        } catch (Exception $e) {
            // return empty buckets on error
        }

        return $result;
    }

    /**
     * Vendor intelligence — history and risk profile for vendors with unpaid bills
     */
    public function getVendorIntelligence(): array
    {
        $result = [];

        try {
            $sixMonthsAgo = date('Y-m-d', strtotime($this->today . ' -6 months'));

            // Current unpaid bills grouped by vendor name
            $current = $this->db->fetchAll(
                "SELECT b.id, b.title, b.vendor, b.amount, b.due_date, b.status,
                        b.category, b.repeat_type, b.repeat_anchor,
                        s.name AS store_name
                 FROM bills b
                 JOIN stores s ON s.id = b.store_id
                 WHERE b.status != 'paid'
                   AND b.vendor IS NOT NULL
                   AND b.vendor != ''
                 ORDER BY b.due_date ASC"
            );

            // Deduplicate: one entry per vendor (earliest unpaid bill wins)
            $seen = [];
            foreach ($current as $bill) {
                $key = strtolower(trim($bill['vendor']));
                if (!isset($seen[$key])) {
                    $seen[$key] = $bill;
                }
            }

            foreach ($seen as $vendorKey => $bill) {
                $vendorName = $bill['vendor'];

                // Paid history last 6 months
                $history = $this->db->fetchAll(
                    "SELECT id, due_date, status
                     FROM bills
                     WHERE LOWER(TRIM(vendor)) = ?
                       AND status = 'paid'
                       AND due_date >= ?",
                    [$vendorKey, $sixMonthsAgo]
                );

                $paidCount   = count($history);
                $onTimeCount = 0;
                $lateCount   = 0;
                foreach ($history as $h) {
                    // Bills marked paid while due_date has not passed = on time
                    // We approximate: due_date >= today at time of payment means on-time
                    // Since we only have due_date and status, treat all paid as on-time
                    // and late bills that were overdue before being paid
                    $onTimeCount++;
                }

                // Days overdue calculation
                $daysOverdue = 0;
                if ($bill['due_date'] < $this->today && $bill['status'] !== 'paid') {
                    $daysOverdue = (int)round(
                        (strtotime($this->today) - strtotime($bill['due_date'])) / 86400
                    );
                }

                // Cycle description
                $cycle = 'One-time';
                $rType = $bill['repeat_type'] ?? 'none';
                if ($rType && $rType !== 'none') {
                    $anchor = $bill['repeat_anchor'] ?? null;
                    $cycle  = ucfirst($rType);
                    if ($rType === 'monthly' && $anchor) {
                        $suffix = match ((int)$anchor % 10) {
                            1  => ((int)$anchor === 11) ? 'th' : 'st',
                            2  => ((int)$anchor === 12) ? 'th' : 'nd',
                            3  => ((int)$anchor === 13) ? 'th' : 'rd',
                            default => 'th',
                        };
                        $cycle = "Monthly ({$anchor}{$suffix})";
                    }
                }

                // Risk level
                $riskLevel = 'low';
                if ($bill['status'] === 'overdue' || $bill['due_date'] < $this->today) {
                    $riskLevel = 'critical';
                } elseif ($bill['due_date'] === $this->today) {
                    $riskLevel = 'high';
                } elseif ($bill['due_date'] <= date('Y-m-d', strtotime($this->today . ' +3 days'))) {
                    $riskLevel = 'medium';
                }

                $result[] = [
                    'vendor_name'  => $vendorName,
                    'category'     => $bill['category'] ?? 'general',
                    'cycle'        => $cycle,
                    'current_bill' => [
                        'id'          => (int)$bill['id'],
                        'amount'      => (float)($bill['amount'] ?? 0),
                        'due_date'    => $bill['due_date'],
                        'status'      => $bill['status'],
                        'days_overdue' => $daysOverdue,
                    ],
                    'history'      => [
                        'paid_count'    => $paidCount,
                        'on_time_count' => $onTimeCount,
                        'late_count'    => $lateCount,
                    ],
                    'risk_level'   => $riskLevel,
                    'store_name'   => $bill['store_name'],
                ];
            }
        } catch (Exception $e) {
            // return empty on error
        }

        return $result;
    }

    /**
     * Total cash at risk = overdue amount + due today amount
     */
    public function getTotalCashRisk(): float
    {
        try {
            $timeline = $this->getCashTimeline();
            return round(
                (float)$timeline['overdue']['amount'] + (float)$timeline['today']['amount'],
                2
            );
        } catch (Exception $e) {
            return 0.0;
        }
    }
}
