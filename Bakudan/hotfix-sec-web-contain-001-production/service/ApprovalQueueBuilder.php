<?php
/**
 * ApprovalQueueBuilder — populate the approval queue from current decision feed.
 *
 * Only creates items for:
 *  - High-impact finance / compliance actions (impact_score >= 70)
 *  - Operations rebalance plans needing manager sign-off
 *
 * Items expire after 24h unless extended.
 * Deduped by approval_id — existing pending items are NOT overwritten.
 */
class ApprovalQueueBuilder {
    private $db;

    private const EXPIRY_HOURS    = 24;
    private const MIN_SCORE_QUEUE = 60; // only queue items above this score

    public function __construct() {
        $this->db = Database::getInstance();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Sync approval queue from active decision feed.
     * Returns count of new items inserted.
     */
    public function build(): int {
        if (!$this->db->tableExists('approval_queue') ||
            !$this->db->tableExists('decision_feed')) {
            return 0;
        }

        // Expire stale items
        $this->db->execute(
            "UPDATE approval_queue
             SET status = 'expired'
             WHERE status = 'pending'
               AND expires_at IS NOT NULL
               AND expires_at < NOW()"
        );

        // Get active decisions above threshold
        $decisions = $this->db->fetchAll(
            "SELECT * FROM decision_feed
             WHERE is_active = 1
               AND impact_score >= ?
             ORDER BY impact_score DESC",
            [self::MIN_SCORE_QUEUE]
        ) ?: [];

        $inserted = 0;
        $now      = date('Y-m-d H:i:s');
        $expiresAt = date('Y-m-d H:i:s', strtotime('+' . self::EXPIRY_HOURS . ' hours'));

        foreach ($decisions as $d) {
            $approvalId = 'aq_' . $d['decision_id'];

            // Only queue finance/compliance decisions — not all operations items
            if ($d['type'] === 'operations' && $d['impact_score'] < 75) continue;

            // Skip if already has a pending/resolved item
            $existing = $this->db->fetch(
                "SELECT id, status FROM approval_queue WHERE approval_id = ?",
                [$approvalId]
            );

            if ($existing && in_array($existing['status'], ['pending', 'approved', 'rejected'])) {
                continue; // Don't overwrite
            }

            $roleScope = json_decode($d['role_scope_json'] ?? '[]', true) ?: [];

            // Build human-readable summary
            $summary = $this->buildSummary($d);

            $payload = [
                'decision_id'    => $d['decision_id'],
                'type'           => $d['type'],
                'cta_type'       => $d['cta_type'],
                'cta_target_id'  => $d['cta_target_id'],
                'business_name'  => $d['business_name'],
                'deadline_label' => $d['deadline_label'],
            ];

            if ($existing) {
                // Re-queue expired item
                $this->db->execute(
                    "UPDATE approval_queue
                     SET status='pending', summary=?, impact_score=?, confidence_score=?,
                         risk_reduction_pct=?, role_scope_json=?, payload_json=?,
                         generated_at=?, expires_at=?, resolved_by=NULL, resolved_at=NULL
                     WHERE approval_id=?",
                    [
                        $summary,
                        $d['impact_score'],
                        $d['confidence_score'],
                        $this->estimateRiskReduction($d),
                        json_encode($roleScope),
                        json_encode($payload, JSON_UNESCAPED_UNICODE),
                        $now,
                        $expiresAt,
                        $approvalId,
                    ]
                );
            } else {
                $this->db->insert(
                    "INSERT INTO approval_queue
                       (approval_id, type, title, summary, impact_score, confidence_score,
                        risk_reduction_pct, role_scope_json, status, payload_json,
                        generated_at, expires_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)",
                    [
                        $approvalId,
                        $d['type'],
                        $d['title'],
                        $summary,
                        $d['impact_score'],
                        $d['confidence_score'],
                        $this->estimateRiskReduction($d),
                        json_encode($roleScope),
                        json_encode($payload, JSON_UNESCAPED_UNICODE),
                        $now,
                        $expiresAt,
                    ]
                );
                $inserted++;
            }
        }

        return $inserted;
    }

    /**
     * Get pending approvals for a given role.
     */
    public function getPendingForRole(string $role, int $limit = 10): array {
        if (!$this->db->tableExists('approval_queue')) return [];

        $rows = $this->db->fetchAll(
            "SELECT * FROM approval_queue
             WHERE status = 'pending'
               AND (expires_at IS NULL OR expires_at > NOW())
             ORDER BY impact_score DESC
             LIMIT 50"
        ) ?: [];

        $isSuperRole = in_array($role, ['admin', 'ceo']);

        $result = [];
        foreach ($rows as $row) {
            $roles = json_decode($row['role_scope_json'] ?? '[]', true) ?: [];
            if ($isSuperRole || in_array($role, $roles) || in_array('all', $roles)) {
                $row['role_scope']  = $roles;
                $row['payload']     = json_decode($row['payload_json'] ?? '{}', true);
                unset($row['role_scope_json'], $row['payload_json']);
                $result[] = $row;
            }
            if (count($result) >= $limit) break;
        }

        return $result;
    }

    /**
     * Count pending approvals for a role.
     */
    public function countPendingForRole(string $role): int {
        return count($this->getPendingForRole($role, 100));
    }

    /**
     * Resolve an approval item (approve or reject).
     */
    public function resolve(string $approvalId, string $status, int $resolvedBy): bool {
        if (!in_array($status, ['approved', 'rejected'])) return false;

        $affected = $this->db->execute(
            "UPDATE approval_queue
             SET status=?, resolved_by=?, resolved_at=NOW()
             WHERE approval_id=? AND status='pending'",
            [$status, $resolvedBy, $approvalId]
        );

        return $affected > 0;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function buildSummary(array $d): string {
        $parts = [];
        if ($d['deadline_label']) $parts[] = $d['deadline_label'];
        if ($d['ignored_effect']) $parts[] = 'Risk if ignored: ' . $d['ignored_effect'];
        if ($d['business_name'])  $parts[] = 'Business: ' . $d['business_name'];
        return implode(' · ', $parts);
    }

    private function estimateRiskReduction(array $d): float {
        // Estimate: resolving a critical issue reduces risk by ~30-50%
        $score = (float)$d['impact_score'];
        if ($score >= 90) return 50.0;
        if ($score >= 70) return 35.0;
        return 20.0;
    }
}
