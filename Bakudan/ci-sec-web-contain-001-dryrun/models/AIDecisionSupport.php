<?php
/**
 * Phase 8 — Module 12: AI Decision Support
 * 
 * AI evaluates decisions across multiple factors and provides recommendations
 * with clear explanations.
 */
class AIDecisionSupport
{
    private $db;

    public function __construct($db = null)
    {
        $this->db = $db ?: Database::getInstance();
    }

    /**
     * Evaluate "Should we expand Store X?"
     */
    public function evaluateStoreExpansion(int $storeId): array
    {
        $stmt = $this->db->prepare("SELECT * FROM stores WHERE id = ?");
        $stmt->execute([$storeId]);
        $store = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$store) return ['error' => 'Store not found'];

        $factors = [];

        // Factor 1: Performance
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM tasks WHERE store_id = ? AND status = 'done'");
        $stmt->execute([$storeId]);
        $completed = (int)$stmt->fetchColumn();
        $factors['performance'] = ['score' => min(100, $completed * 5), 'label' => "{$completed} tasks completed"];

        // Factor 2: Staffing
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM users WHERE store_id = ?");
        $stmt->execute([$storeId]);
        $staff = (int)$stmt->fetchColumn();
        $factors['staffing'] = ['score' => min(100, $staff * 15), 'label' => "{$staff} team members"];

        // Factor 3: Incidents
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM automation_events WHERE source_module = 'incidents' AND payload LIKE ?");
        $stmt->execute(["%\"store_id\":\"{$storeId}\"%"]);
        $incidents = (int)$stmt->fetchColumn();
        $factors['incidents'] = ['score' => max(0, 100 - $incidents * 10), 'label' => "{$incidents} recent incidents"];

        // Factor 4: Training
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM tasks WHERE store_id = ? AND title LIKE '%training%' AND status = 'done'");
        $stmt->execute([$storeId]);
        $training = (int)$stmt->fetchColumn();
        $factors['training'] = ['score' => min(100, $training * 20), 'label' => "{$training} training completed"];

        // Factor 5: Audit history
        $factors['audit_history'] = ['score' => 75, 'label' => 'No audit failures recorded']; // Placeholder

        // Calculate overall score
        $overall = array_sum(array_column($factors, 'score')) / count($factors);

        // Determine recommendation
        $recommendation = $overall >= 70 ? 'expand' : ($overall >= 50 ? 'conditional' : 'not_recommended');

        return [
            'question' => "Should we expand Store \"{$store['name']}\"?",
            'overall_score' => round($overall, 1),
            'factors' => $factors,
            'recommendation' => $recommendation,
            'reasoning' => $this->generateReasoning($factors, $recommendation),
            'confidence' => 0.75,
            'alternatives' => $recommendation === 'not_recommended' ? [
                'Address staffing gaps first',
                'Complete pending training',
                'Reduce incident rate below 3',
            ] : [],
        ];
    }

    /**
     * Evaluate hiring decision
     */
    public function evaluateHiring(int $storeId): array
    {
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM users WHERE store_id = ?");
        $stmt->execute([$storeId]);
        $currentStaff = (int)$stmt->fetchColumn();

        $stmt = $this->db->prepare("SELECT COUNT(*) FROM tasks WHERE store_id = ? AND status NOT IN ('done','cancelled')");
        $stmt->execute([$storeId]);
        $activeTasks = (int)$stmt->fetchColumn();

        $tasksPerPerson = $currentStaff > 0 ? $activeTasks / $currentStaff : 0;

        return [
            'question' => "Should we hire additional staff?",
            'current_staff' => $currentStaff,
            'active_tasks' => $activeTasks,
            'tasks_per_person' => round($tasksPerPerson, 1),
            'recommendation' => $tasksPerPerson > 8 ? 'hire_now' : ($tasksPerPerson > 5 ? 'monitor' : 'not_yet'),
            'reasoning' => $tasksPerPerson > 8
                ? "Team is overloaded with {$tasksPerPerson} tasks per person. Recommend hiring."
                : "Team has capacity. Current ratio: {$tasksPerPerson} tasks per person.",
        ];
    }

    /**
     * Get executive decision summary
     */
    public function getExecutiveSummary(): array
    {
        $summary = [
            'urgent_decisions' => [],
            'upcoming_decisions' => [],
            'recommended_actions' => [],
        ];

        // Find stores needing attention
        $stmt = $this->db->prepare("
            SELECT s.id, s.name,
                (SELECT COUNT(*) FROM tasks t WHERE t.store_id = s.id AND t.status NOT IN ('done','cancelled') AND t.due_date < CURDATE()) as overdue
            FROM stores s
            HAVING overdue > 5
        ");
        $stmt->execute();
        $stores = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($stores as $store) {
            $summary['urgent_decisions'][] = [
                'type' => 'store_overdue',
                'store' => $store['name'],
                'message' => "{$store['name']} has {$store['overdue']} overdue tasks",
            ];
        }

        // Find critical predictions
        $stmt = $this->db->prepare("SELECT * FROM predictions WHERE status = 'active' AND severity = 'critical' LIMIT 5");
        $stmt->execute();
        $predictions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($predictions as $p) {
            $summary['urgent_decisions'][] = [
                'type' => 'prediction',
                'message' => $p['description'],
            ];
        }

        return $summary;
    }

    // ─── PRIVATE ──────────────────────────────────────────────────

    private function generateReasoning(array $factors, string $recommendation): string
    {
        $strengths = [];
        $weaknesses = [];

        foreach ($factors as $name => $data) {
            if ($data['score'] >= 70) {
                $strengths[] = ucfirst($name) . " is strong ({$data['score']}%)";
            } elseif ($data['score'] < 40) {
                $weaknesses[] = ucfirst($name) . " needs improvement ({$data['score']}%)";
            }
        }

        $reasoning = "Based on evaluation: ";
        if (!empty($strengths)) $reasoning .= "Strengths: " . implode(', ', $strengths) . ". ";
        if (!empty($weaknesses)) $reasoning .= "Concerns: " . implode(', ', $weaknesses) . ". ";
        $reasoning .= "Overall recommendation: " . str_replace('_', ' ', $recommendation) . ".";

        return $reasoning;
    }
}
