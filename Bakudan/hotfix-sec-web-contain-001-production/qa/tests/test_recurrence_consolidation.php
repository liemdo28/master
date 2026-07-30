<?php
/**
 * test_recurrence_consolidation.php
 *
 * Focused verification for recurrence consolidation hardening:
 * - Task::update() no longer triggers recurrence
 * - completion_date end-rule uses computed nextDueDate consistently
 *
 * Run: php qa/tests/test_recurrence_consolidation.php
 */

$passed = 0;
$failed = 0;

function ok($cond, $label) {
    global $passed, $failed;
    if ($cond) { echo "  ✅ PASS: $label\n"; $passed++; }
    else { echo "  ❌ FAIL: $label\n"; $failed++; }
}

function eq($expected, $actual, $label) {
    ok($expected === $actual, $label . " (expected=" . var_export($expected, true) . ", actual=" . var_export($actual, true) . ")");
}

// ── Stub Database before anything loads Task ──
if (!class_exists('Database')) {
    class Database {
        private static $instance = null;
        public static function getInstance() {
            if (self::$instance === null) self::$instance = new self();
            return self::$instance;
        }
        public function fetch($sql, $params = []) { return null; }
        public function fetchAll($sql, $params = []) { return []; }
        public function insert($sql, $params = []) { return 0; }
        public function update($sql, $params = []) { return 1; }
        public function delete($sql, $params = []) { return 0; }
        public function query($sql, $params = []) { return null; }
        public function getConnection() { return null; }
        public function tableExists($t) { return false; }
        public function columnExists($t, $c) { return false; }
    }
}

if (!function_exists('canAdmin')) { function canAdmin() { return false; } }
if (!function_exists('canManage')) { function canManage() { return false; } }
if (!function_exists('app_today')) { require_once __DIR__ . '/../../config/time.php'; }

require_once __DIR__ . '/../../models/Task.php';

// ── Test subclass: calls parent::__construct() so $this->db is initialized ──
class SpyTaskForConsolidation extends Task {
    public $createNextCalls = 0;
    private $fakeTask;

    public function __construct(array $fakeTask) {
        parent::__construct(); // initializes $this->db to stub Database singleton
        $this->fakeTask = $fakeTask;
    }

    public function findById($id) {
        return $this->fakeTask;
    }

    public function createNextRecurringOccurrence($taskId, bool $useCompletionDate = false) {
        $this->createNextCalls++;
        return 12345;
    }

    public function addWatcher($taskId, $userId) { return true; }
}

// ── Test subclass for shouldRecurrenceContinueForDate via Reflection ──
class CompletionDateCheckTask extends Task {
    public function __construct() {
        parent::__construct();
    }

    public function exposedShouldContinueForDate(array $source, array $completedTask, ?string $nextDueDate): bool {
        $ref = new ReflectionClass(Task::class);
        $method = $ref->getMethod('shouldRecurrenceContinueForDate');
        $method->setAccessible(true);
        return $method->invoke($this, $source, $completedTask, $nextDueDate);
    }
}

function makeTask(array $overrides = []): array {
    return array_merge([
        'id' => 100, 'project_id' => 1, 'section_id' => 1,
        'title' => 'Recurring Test', 'description' => '', 'notes' => null,
        'assignee_id' => 1, 'priority' => 'medium', 'status' => 'todo',
        'visibility' => 'private', 'due_date' => '2026-05-28', 'start_date' => null,
        'created_by' => 1, 'is_completed' => 0,
        'repeat_type' => 'daily', 'repeat_config' => '{"interval":1}',
        'repeat_from_mode' => 'due_date', 'repeat_end_type' => 'never',
        'repeat_end_date' => null, 'repeat_end_count' => null,
        'recurring_root_id' => 100, 'occurrence_index' => 0,
    ], $overrides);
}

echo "═══════════════════════════════════════════════════════════════\n";
echo "  Recurrence Consolidation Verification\n";
echo "═══════════════════════════════════════════════════════════════\n\n";

// ─── Test A: update(status=done) does NOT trigger recurrence ─────────
$spy = new SpyTaskForConsolidation(makeTask(['status' => 'todo', 'is_completed' => 0]));
$spy->update(100, ['status' => 'done']);
eq(0, $spy->createNextCalls, 'Task::update(status=done) does NOT trigger recurrence');

// ─── Test B: update(is_completed=1) does NOT trigger recurrence ──────
$spy2 = new SpyTaskForConsolidation(makeTask(['status' => 'todo', 'is_completed' => 0]));
$spy2->update(100, ['is_completed' => 1]);
eq(0, $spy2->createNextCalls, 'Task::update(is_completed=1) does NOT trigger recurrence');

// ─── Test C: shouldRecurrenceContinueForDate — completion_date mode ──
$checker = new CompletionDateCheckTask();

$source = makeTask([
    'repeat_type' => 'daily', 'repeat_from_mode' => 'completion_date',
    'repeat_end_type' => 'date', 'repeat_end_date' => '2026-06-03',
]);
$completed = makeTask(['is_completed' => 1, 'completed_at' => '2026-06-01 09:00:00', 'occurrence_index' => 0]);

ok($checker->exposedShouldContinueForDate($source, $completed, '2026-06-02') === true,
   'end-rule date: nextDueDate 2026-06-02 <= end 2026-06-03 → continue');
ok($checker->exposedShouldContinueForDate($source, $completed, '2026-06-04') === false,
   'end-rule date: nextDueDate 2026-06-04 > end 2026-06-03 → stop');
ok($checker->exposedShouldContinueForDate($source, $completed, '2026-06-03') === true,
   'end-rule date: nextDueDate == end → continue (<=)');
ok($checker->exposedShouldContinueForDate($source, $completed, null) === false,
   'end-rule date: null nextDueDate → stop');

echo "\n═══════════════════════════════════════════════════════════════\n";
echo "=== Results: {$passed} passed, {$failed} failed ===\n";
echo "═══════════════════════════════════════════════════════════════\n";
exit($failed > 0 ? 1 : 0);
