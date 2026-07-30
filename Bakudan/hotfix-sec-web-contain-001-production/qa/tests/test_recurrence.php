<?php
/**
 * test_recurrence.php — Comprehensive unit tests for recurrence system.
 *
 * Tests ALL recurrence date calculations WITHOUT touching the database.
 * Run: php qa/tests/test_recurrence.php
 *
 * Covers:
 *   - Daily interval 1, 3, 7
 *   - Weekly interval 1 (single day, multiple days)
 *   - Monthly interval 1 (day 15, day 31 → Feb clamp)
 *   - Yearly interval 1 (Feb 29 → non-leap year)
 *   - shouldContinue() end rules: never, date, count
 *   - Edge cases: null due_date, empty repeat_config, invalid repeat_type
 */

// ══════════════════════════════════════════════════════════════════════
// Test runner
// ══════════════════════════════════════════════════════════════════════
$passed = 0;
$failed = 0;

function assert_eq($expected, $actual, $label) {
    global $passed, $failed;
    if ($expected === $actual) {
        echo "  ✅ PASS: $label\n";
        $passed++;
    } else {
        echo "  ❌ FAIL: $label\n";
        echo "     Expected: " . var_export($expected, true) . "\n";
        echo "     Actual:   " . var_export($actual, true) . "\n";
        $failed++;
    }
}

function assert_null($actual, $label) {
    global $passed, $failed;
    if ($actual === null) {
        echo "  ✅ PASS: $label\n";
        $passed++;
    } else {
        echo "  ❌ FAIL: $label\n";
        echo "     Expected: NULL\n";
        echo "     Actual:   " . var_export($actual, true) . "\n";
        $failed++;
    }
}

function assert_true($actual, $label) {
    global $passed, $failed;
    if ($actual === true) {
        echo "  ✅ PASS: $label\n";
        $passed++;
    } else {
        echo "  ❌ FAIL: $label\n";
        echo "     Expected: true\n";
        echo "     Actual:   " . var_export($actual, true) . "\n";
        $failed++;
    }
}

function assert_false($actual, $label) {
    global $passed, $failed;
    if ($actual === false) {
        echo "  ✅ PASS: $label\n";
        $passed++;
    } else {
        echo "  ❌ FAIL: $label\n";
        echo "     Expected: false\n";
        echo "     Actual:   " . var_export($actual, true) . "\n";
        $failed++;
    }
}

// ══════════════════════════════════════════════════════════════════════
// Bootstrap (minimal — no database connection needed)
// ══════════════════════════════════════════════════════════════════════

// Define stubs for functions/classes that would normally require DB

// Prevent Database singleton from connecting
if (!class_exists('Database')) {
    class Database {
        private static $instance = null;
        public static function getInstance() {
            if (self::$instance === null) {
                self::$instance = new self();
            }
            return self::$instance;
        }
        // Stub all DB methods to prevent actual queries
        public function fetch($sql, $params = []) { return null; }
        public function fetchAll($sql, $params = []) { return []; }
        public function insert($sql, $params = []) { return 0; }
        public function update($sql, $params = []) { return 0; }
        public function delete($sql, $params = []) { return 0; }
        public function query($sql, $params = []) { return null; }
        public function getConnection() { return null; }
        public function tableExists($t) { return false; }
        public function columnExists($t, $c) { return false; }
    }
}

// Stub auth helpers used by Task model
if (!function_exists('canAdmin')) {
    function canAdmin() { return false; }
}
if (!function_exists('canManage')) {
    function canManage() { return false; }
}

// Load time helpers (app_timezone, app_today, app_now)
require_once __DIR__ . '/../../config/time.php';

// Load Task model and RecurringTaskService
require_once __DIR__ . '/../../models/Task.php';
require_once __DIR__ . '/../../service/RecurringTaskService.php';

// ══════════════════════════════════════════════════════════════════════
// Test-friendly Task subclass that avoids DB lookups
// ══════════════════════════════════════════════════════════════════════
class TestableTask extends Task {
    public function __construct() {
        // Skip parent constructor to avoid Database::getInstance() connection
    }

    /**
     * Override recurringSourceTask to return the task itself (no DB lookup).
     * This allows nextOccurrenceDueDateFrom to work without a database.
     */
    protected function recurringSourceTask($task) {
        return $task;
    }
}

// ══════════════════════════════════════════════════════════════════════
// Helper: create a RecurringTaskService with our testable Task
// ══════════════════════════════════════════════════════════════════════
function createService(): RecurringTaskService {
    $task = new TestableTask();
    return new RecurringTaskService($task);
}

function makeTask(array $overrides = []): array {
    return array_merge([
        'id' => 99999,
        'project_id' => 1,
        'section_id' => 1,
        'title' => 'Test Task',
        'description' => '',
        'notes' => null,
        'assignee_id' => 1,
        'priority' => 'medium',
        'status' => 'todo',
        'visibility' => 'private',
        'due_date' => '2026-05-28',
        'start_date' => null,
        'created_by' => 1,
        'repeat_type' => 'daily',
        'repeat_config' => '{"interval":1}',
        'repeat_from_mode' => 'due_date',
        'repeat_end_type' => 'never',
        'repeat_end_date' => null,
        'repeat_end_count' => null,
        'recurring_root_id' => 99999,
        'occurrence_index' => 0,
    ], $overrides);
}

// ══════════════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════════════

$svc = createService();

echo "═══════════════════════════════════════════════════════════════\n";
echo "  Recurrence System — Comprehensive Test Suite\n";
echo "═══════════════════════════════════════════════════════════════\n\n";

// ─── 1. Daily Recurrence ─────────────────────────────────────────────
echo "─── Daily Recurrence ─────────────────────────────────────────\n";

// Daily interval 1
$task = makeTask(['due_date' => '2026-05-28', 'repeat_type' => 'daily', 'repeat_config' => '{"interval":1}']);
assert_eq('2026-05-29', $svc->computeNextDueDate($task), 'Daily interval 1: 2026-05-28 → 2026-05-29');

// Daily interval 3
$task = makeTask(['due_date' => '2026-05-28', 'repeat_type' => 'daily', 'repeat_config' => '{"interval":3}']);
assert_eq('2026-05-31', $svc->computeNextDueDate($task), 'Daily interval 3: 2026-05-28 → 2026-05-31');

// Daily interval 7
$task = makeTask(['due_date' => '2026-05-28', 'repeat_type' => 'daily', 'repeat_config' => '{"interval":7}']);
assert_eq('2026-06-04', $svc->computeNextDueDate($task), 'Daily interval 7: 2026-05-28 → 2026-06-04');

// Daily crossing month boundary
$task = makeTask(['due_date' => '2026-01-30', 'repeat_type' => 'daily', 'repeat_config' => '{"interval":3}']);
assert_eq('2026-02-02', $svc->computeNextDueDate($task), 'Daily interval 3 crossing month: 2026-01-30 → 2026-02-02');

// Daily crossing year boundary
$task = makeTask(['due_date' => '2026-12-30', 'repeat_type' => 'daily', 'repeat_config' => '{"interval":3}']);
assert_eq('2027-01-02', $svc->computeNextDueDate($task), 'Daily interval 3 crossing year: 2026-12-30 → 2027-01-02');

echo "\n";

// ─── 2. Weekly Recurrence ────────────────────────────────────────────
echo "─── Weekly Recurrence ────────────────────────────────────────\n";

// Reference dates:
// 2026-05-25 = Monday (N=1)
// 2026-05-27 = Wednesday (N=3)
// 2026-05-29 = Friday (N=5)
// 2026-05-28 = Thursday (N=4)

// Weekly interval 1, single day (no days specified → uses due_date's weekday)
// 2026-05-28 is Thursday (N=4), next Thursday = 2026-06-04
$task = makeTask(['due_date' => '2026-05-28', 'repeat_type' => 'weekly', 'repeat_config' => '{"interval":1}']);
assert_eq('2026-06-04', $svc->computeNextDueDate($task), 'Weekly interval 1, single day (Thu→Thu): 2026-05-28 → 2026-06-04');

// Weekly interval 1, explicit single day: Monday (1)
// From Monday 2026-05-25, days=[1], currentWeekday=1, no day > 1
// delta = (1*7) - 1 + 1 = 7 → 2026-06-01
$task = makeTask(['due_date' => '2026-05-25', 'repeat_type' => 'weekly', 'repeat_config' => '{"interval":1,"days":[1]}']);
assert_eq('2026-06-01', $svc->computeNextDueDate($task), 'Weekly interval 1, Mon only from Mon: 2026-05-25 → 2026-06-01');

// Weekly interval 1, multiple days: Mon(1), Wed(3), Fri(5)
// From Monday 2026-05-25 (N=1): first day > 1 is 3 → +2 days = 2026-05-27 (Wed)
$task = makeTask(['due_date' => '2026-05-25', 'repeat_type' => 'weekly', 'repeat_config' => '{"interval":1,"days":[1,3,5]}']);
assert_eq('2026-05-27', $svc->computeNextDueDate($task), 'Weekly interval 1, Mon/Wed/Fri, from Mon → Wed same week');

// From Wednesday 2026-05-27 (N=3): first day > 3 is 5 → +2 days = 2026-05-29 (Fri)
$task = makeTask(['due_date' => '2026-05-27', 'repeat_type' => 'weekly', 'repeat_config' => '{"interval":1,"days":[1,3,5]}']);
assert_eq('2026-05-29', $svc->computeNextDueDate($task), 'Weekly interval 1, Mon/Wed/Fri, from Wed → Fri same week');

// From Friday 2026-05-29 (N=5): no day > 5 in [1,3,5]
// delta = (1*7) - 5 + 1 = 3 → 2026-06-01 (Mon)
$task = makeTask(['due_date' => '2026-05-29', 'repeat_type' => 'weekly', 'repeat_config' => '{"interval":1,"days":[1,3,5]}']);
assert_eq('2026-06-01', $svc->computeNextDueDate($task), 'Weekly interval 1, Mon/Wed/Fri, from Fri → Mon next week');

// Weekly interval 2, Mon only from Monday 2026-05-25
// No day > 1, delta = (2*7) - 1 + 1 = 14 → 2026-06-08 (Mon)
$task = makeTask(['due_date' => '2026-05-25', 'repeat_type' => 'weekly', 'repeat_config' => '{"interval":2,"days":[1]}']);
assert_eq('2026-06-08', $svc->computeNextDueDate($task), 'Weekly interval 2, Mon only: 2026-05-25 → 2026-06-08');

// Weekly interval 1, Tue/Thu (2,4) from Thursday 2026-05-28 (N=4)
// No day > 4 in [2,4], delta = (1*7) - 4 + 2 = 5 → 2026-06-02 (Tue)
$task = makeTask(['due_date' => '2026-05-28', 'repeat_type' => 'weekly', 'repeat_config' => '{"interval":1,"days":[2,4]}']);
assert_eq('2026-06-02', $svc->computeNextDueDate($task), 'Weekly interval 1, Tue/Thu, from Thu → Tue next week');

echo "\n";

// ─── 3. Monthly Recurrence ───────────────────────────────────────────
echo "─── Monthly Recurrence ───────────────────────────────────────\n";

// Monthly interval 1, day 15
$task = makeTask(['due_date' => '2026-05-15', 'repeat_type' => 'monthly', 'repeat_config' => '{"interval":1,"day_of_month":15}']);
assert_eq('2026-06-15', $svc->computeNextDueDate($task), 'Monthly interval 1, day 15: May → Jun 15');

// Monthly interval 1, day 31 → Feb clamp (non-leap year 2026)
$task = makeTask(['due_date' => '2026-01-31', 'repeat_type' => 'monthly', 'repeat_config' => '{"interval":1,"day_of_month":31}']);
assert_eq('2026-02-28', $svc->computeNextDueDate($task), 'Monthly interval 1, day 31 → Feb 28 (non-leap 2026)');

// Monthly interval 1, day 31 → Feb clamp (leap year 2028)
$task = makeTask(['due_date' => '2028-01-31', 'repeat_type' => 'monthly', 'repeat_config' => '{"interval":1,"day_of_month":31}']);
assert_eq('2028-02-29', $svc->computeNextDueDate($task), 'Monthly interval 1, day 31 → Feb 29 (leap 2028)');

// Monthly interval 1, day 31 → Apr 30 (April has 30 days)
$task = makeTask(['due_date' => '2026-03-31', 'repeat_type' => 'monthly', 'repeat_config' => '{"interval":1,"day_of_month":31}']);
assert_eq('2026-04-30', $svc->computeNextDueDate($task), 'Monthly interval 1, day 31: Mar → Apr 30');

// Monthly interval 1, day 15 crossing year boundary
$task = makeTask(['due_date' => '2026-12-15', 'repeat_type' => 'monthly', 'repeat_config' => '{"interval":1,"day_of_month":15}']);
assert_eq('2027-01-15', $svc->computeNextDueDate($task), 'Monthly interval 1, day 15: Dec 2026 → Jan 2027');

// Monthly interval 2
$task = makeTask(['due_date' => '2026-01-31', 'repeat_type' => 'monthly', 'repeat_config' => '{"interval":2,"day_of_month":31}']);
assert_eq('2026-03-31', $svc->computeNextDueDate($task), 'Monthly interval 2, day 31: Jan → Mar 31');

// Monthly interval 1, day 30 → Feb clamp
$task = makeTask(['due_date' => '2026-01-30', 'repeat_type' => 'monthly', 'repeat_config' => '{"interval":1,"day_of_month":30}']);
assert_eq('2026-02-28', $svc->computeNextDueDate($task), 'Monthly interval 1, day 30 → Feb 28 (non-leap)');

echo "\n";

// ─── 4. Yearly Recurrence ────────────────────────────────────────────
echo "─── Yearly Recurrence ────────────────────────────────────────\n";

// Yearly interval 1, normal date
$task = makeTask(['due_date' => '2026-05-28', 'repeat_type' => 'yearly', 'repeat_config' => '{"interval":1}']);
assert_eq('2027-05-28', $svc->computeNextDueDate($task), 'Yearly interval 1: 2026-05-28 → 2027-05-28');

// Yearly interval 1, Feb 29 leap → non-leap year clamp
$task = makeTask(['due_date' => '2028-02-29', 'repeat_type' => 'yearly', 'repeat_config' => '{"interval":1}']);
assert_eq('2029-02-28', $svc->computeNextDueDate($task), 'Yearly interval 1: Feb 29 2028 → Feb 28 2029 (non-leap)');

// Yearly interval 4, Feb 29 → next leap year
$task = makeTask(['due_date' => '2028-02-29', 'repeat_type' => 'yearly', 'repeat_config' => '{"interval":4}']);
assert_eq('2032-02-29', $svc->computeNextDueDate($task), 'Yearly interval 4: Feb 29 2028 → Feb 29 2032 (leap)');

// Yearly interval 1, Dec 31
$task = makeTask(['due_date' => '2026-12-31', 'repeat_type' => 'yearly', 'repeat_config' => '{"interval":1}']);
assert_eq('2027-12-31', $svc->computeNextDueDate($task), 'Yearly interval 1: Dec 31 2026 → Dec 31 2027');

// Yearly interval 2
$task = makeTask(['due_date' => '2026-03-15', 'repeat_type' => 'yearly', 'repeat_config' => '{"interval":2}']);
assert_eq('2028-03-15', $svc->computeNextDueDate($task), 'Yearly interval 2: 2026-03-15 → 2028-03-15');

echo "\n";

// ─── 5. shouldContinue() — End Rule: never ──────────────────────────
echo "─── shouldContinue() — End Rule: never ──────────────────────\n";

$task = makeTask(['repeat_end_type' => 'never']);
assert_true($svc->shouldContinue($task), 'never → always true');

$task = makeTask(['repeat_end_type' => 'never', 'occurrence_index' => 100]);
assert_true($svc->shouldContinue($task), 'never → true even at occurrence 100');

$task = makeTask(['repeat_end_type' => 'never', 'repeat_end_count' => 5, 'repeat_end_date' => '2020-01-01']);
assert_true($svc->shouldContinue($task), 'never → true (ignores count and date fields)');

echo "\n";

// ─── 6. shouldContinue() — End Rule: date ───────────────────────────
echo "─── shouldContinue() — End Rule: date ───────────────────────\n";

// Next due (2026-05-29) is before end_date (2026-12-31) → continue
$task = makeTask([
    'due_date' => '2026-05-28',
    'repeat_type' => 'daily',
    'repeat_config' => '{"interval":1}',
    'repeat_end_type' => 'date',
    'repeat_end_date' => '2026-12-31',
]);
assert_true($svc->shouldContinue($task), 'date: next 2026-05-29 <= end 2026-12-31 → true');

// Next due (2026-05-29) is after end_date (2026-05-28) → stop
$task = makeTask([
    'due_date' => '2026-05-28',
    'repeat_type' => 'daily',
    'repeat_config' => '{"interval":1}',
    'repeat_end_type' => 'date',
    'repeat_end_date' => '2026-05-28',
]);
assert_false($svc->shouldContinue($task), 'date: next 2026-05-29 > end 2026-05-28 → false');

// Next due equals end_date exactly → continue (<=)
$task = makeTask([
    'due_date' => '2026-05-28',
    'repeat_type' => 'daily',
    'repeat_config' => '{"interval":1}',
    'repeat_end_type' => 'date',
    'repeat_end_date' => '2026-05-29',
]);
assert_true($svc->shouldContinue($task), 'date: next 2026-05-29 == end 2026-05-29 → true');

// No end_date set → treat as never (continue)
$task = makeTask([
    'due_date' => '2026-05-28',
    'repeat_type' => 'daily',
    'repeat_config' => '{"interval":1}',
    'repeat_end_type' => 'date',
    'repeat_end_date' => null,
]);
assert_true($svc->shouldContinue($task), 'date: null end_date → true (treat as never)');

echo "\n";

// ─── 7. shouldContinue() — End Rule: count ──────────────────────────
echo "─── shouldContinue() — End Rule: count ──────────────────────\n";

// occurrence_index=0, max=5 → (0+1)=1 < 5 → continue
$task = makeTask(['repeat_end_type' => 'count', 'repeat_end_count' => 5, 'occurrence_index' => 0]);
assert_true($svc->shouldContinue($task), 'count: index=0, max=5 → true');

// occurrence_index=3, max=5 → (3+1)=4 < 5 → continue
$task = makeTask(['repeat_end_type' => 'count', 'repeat_end_count' => 5, 'occurrence_index' => 3]);
assert_true($svc->shouldContinue($task), 'count: index=3, max=5 → true');

// occurrence_index=4, max=5 → (4+1)=5 NOT < 5 → stop
$task = makeTask(['repeat_end_type' => 'count', 'repeat_end_count' => 5, 'occurrence_index' => 4]);
assert_false($svc->shouldContinue($task), 'count: index=4, max=5 → false (exhausted)');

// occurrence_index=0, max=1 → (0+1)=1 NOT < 1 → stop
$task = makeTask(['repeat_end_type' => 'count', 'repeat_end_count' => 1, 'occurrence_index' => 0]);
assert_false($svc->shouldContinue($task), 'count: index=0, max=1 → false');

// max=0 → treat as never (continue)
$task = makeTask(['repeat_end_type' => 'count', 'repeat_end_count' => 0, 'occurrence_index' => 50]);
assert_true($svc->shouldContinue($task), 'count: max=0 → true (invalid, treat as never)');

// Negative max → treat as never
$task = makeTask(['repeat_end_type' => 'count', 'repeat_end_count' => -1, 'occurrence_index' => 0]);
assert_true($svc->shouldContinue($task), 'count: max=-1 → true (invalid, treat as never)');

echo "\n";

// ─── 8. Edge Cases ───────────────────────────────────────────────────
echo "─── Edge Cases ─────────────────────────────────────────────────\n";

// null due_date → returns null
$task = makeTask(['due_date' => null, 'repeat_type' => 'daily', 'repeat_config' => '{"interval":1}']);
assert_null($svc->computeNextDueDate($task), 'null due_date → returns null');

$task = makeTask(['due_date' => '', 'repeat_type' => 'weekly', 'repeat_config' => '{"interval":1,"days":[1]}']);
assert_null($svc->computeNextDueDate($task), 'empty string due_date → returns null');

// empty repeat_config → uses defaults (interval=1)
$task = makeTask(['due_date' => '2026-05-28', 'repeat_type' => 'daily', 'repeat_config' => '{}']);
assert_eq('2026-05-29', $svc->computeNextDueDate($task), 'empty repeat_config {} → uses default interval=1');

$task = makeTask(['due_date' => '2026-05-28', 'repeat_type' => 'daily', 'repeat_config' => null]);
assert_eq('2026-05-29', $svc->computeNextDueDate($task), 'null repeat_config → uses default interval=1');

$task = makeTask(['due_date' => '2026-05-28', 'repeat_type' => 'daily', 'repeat_config' => '']);
assert_eq('2026-05-29', $svc->computeNextDueDate($task), 'empty string repeat_config → uses default interval=1');

// invalid repeat_type → returns null
$task = makeTask(['due_date' => '2026-05-28', 'repeat_type' => 'invalid_type', 'repeat_config' => '{"interval":1}']);
assert_null($svc->computeNextDueDate($task), 'invalid repeat_type "invalid_type" → returns null');

$task = makeTask(['due_date' => '2026-05-28', 'repeat_type' => 'hourly', 'repeat_config' => '{"interval":1}']);
assert_null($svc->computeNextDueDate($task), 'invalid repeat_type "hourly" → returns null');

$task = makeTask(['due_date' => '2026-05-28', 'repeat_type' => '', 'repeat_config' => '{"interval":1}']);
assert_null($svc->computeNextDueDate($task), 'empty repeat_type → returns null');

// repeat_type = 'none' → returns null
$task = makeTask(['due_date' => '2026-05-28', 'repeat_type' => 'none', 'repeat_config' => '{"interval":1}']);
assert_null($svc->computeNextDueDate($task), 'repeat_type "none" → returns null');

echo "\n";

// ══════════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════════════════\n";
echo "\n=== Results: {$passed} passed, {$failed} failed ===\n";
echo "═══════════════════════════════════════════════════════════════\n";
exit($failed > 0 ? 1 : 0);
