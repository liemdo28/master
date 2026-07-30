<?php
/**
 * Admin API — Penalty Configuration
 *
 * GET  /api/admin/penalty-config   — read current config
 * POST /api/admin/penalty-config   — update penalty amount (admin only)
 */
require_once __DIR__ . '/ApiController.php';
require_once __DIR__ . '/../../../service/PenaltyService.php';

class PenaltyConfigApiController extends ApiController {
    private PenaltyService $penaltyService;

    public function __construct() {
        parent::__construct();
        $this->penaltyService = new PenaltyService();
    }

    // ── GET /api/admin/penalty-config ─────────────────────────────────────────

    public function show(): void {
        $this->requireAuth();
        if (!$this->isAdmin()) {
            api_error('Forbidden', 403);
        }

        $row = $this->db->fetch(
            "SELECT id, penalty_amount, currency, updated_by, updated_at
             FROM penalty_config
             ORDER BY id DESC LIMIT 1"
        );

        if (!$row) {
            $row = ['penalty_amount' => 500000, 'currency' => 'VND', 'updated_by' => null, 'updated_at' => null];
        }

        $updatedByName = null;
        if (!empty($row['updated_by'])) {
            $u = $this->db->fetch("SELECT name FROM users WHERE id = ?", [(int)$row['updated_by']]);
            $updatedByName = $u['name'] ?? null;
        }

        api_response([
            'penalty_amount'    => (float)$row['penalty_amount'],
            'currency'          => $row['currency'],
            'updated_by'        => (int)($row['updated_by'] ?? 0) ?: null,
            'updated_by_name'   => $updatedByName,
            'updated_at'        => $row['updated_at'],
        ]);
    }

    // ── POST /api/admin/penalty-config ────────────────────────────────────────

    public function update(): void {
        $this->requireAuth();
        if (!$this->isAdmin()) {
            api_error('Forbidden', 403);
        }

        $body = $this->getJsonInput();

        $amount   = isset($body['penalty_amount']) ? (float)$body['penalty_amount'] : null;
        $currency = isset($body['currency']) ? trim($body['currency']) : 'VND';

        if ($amount === null) {
            api_error('Validation failed', 422, ['penalty_amount' => ['penalty_amount is required']]);
        }
        if ($amount < 0) {
            api_error('Validation failed', 422, ['penalty_amount' => ['penalty_amount must be >= 0']]);
        }
        if (strlen($currency) === 0) {
            $currency = 'VND';
        }

        $this->db->insert(
            "INSERT INTO penalty_config (penalty_amount, currency, updated_by, updated_at)
             VALUES (?, ?, ?, NOW())",
            [$amount, $currency, $this->userId]
        );

        $this->auditLog('penalty_config_updated', 'penalty_config', 0, [
            'penalty_amount' => $amount,
            'currency'       => $currency,
        ]);

        api_response([
            'penalty_amount' => $amount,
            'currency'       => $currency,
            'updated_by'     => $this->userId,
            'updated_at'     => date('Y-m-d H:i:s'),
        ], 'Penalty config updated');
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private function isAdmin(): bool {
        return isset($this->user['role']) && $this->user['role'] === 'admin';
    }
}
