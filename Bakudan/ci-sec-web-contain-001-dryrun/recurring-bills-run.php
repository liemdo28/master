<?php
/**
 * Recurring Bills Auto-Creator
 * Access: /recurring-bills-run.php?run=1
 * Cron: 5 0 * * * /usr/bin/php recurring-bills-run.php
 * 
 * Rules:
 * - Each bill exists max 1 per month per store per title
 * - Created from template bills (repeat_rule IS NOT NULL)
 * - Idempotent: safe to run multiple times
 * - Logs to recurring_bill_history table
 */
error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: application/json; charset=utf-8');

// Allow both CLI and web access
if (php_sapi_name() !== 'cli' && empty($_GET['run'])) {
    echo json_encode(['error' => 'Add ?run=1 to execute']);
    exit;
}

require_once __DIR__ . '/config/database.php';
$db = Database::getInstance();
$pdo = $db->getConnection();

$stats = [
    'ts' => date('c'),
    'templates_found' => 0,
    'bills_generated' => 0,
    'skipped_existing' => 0,
    'errors' => [],
];

try {
    // 1. Find all active template bills with repeat_rule
    $templates = $db->fetchAll("
        SELECT b.*, COALESCE(s.name, 'Unknown') AS store_name
        FROM bills b
        LEFT JOIN stores s ON s.id = b.store_id
        WHERE b.repeat_rule IS NOT NULL
        AND b.repeat_rule != ''
        AND (b.is_archived = 0 OR b.is_archived IS NULL)
    ");
    
    $stats['templates_found'] = count($templates);
    
    if (empty($templates)) {
        echo json_encode($stats);
        exit;
    }
    
    foreach ($templates as $tpl) {
        $tplId = (int)$tpl['id'];
        $title = $tpl['title'];
        $storeId = (int)$tpl['store_id'];
        $amount = (float)($tpl['amount'] ?? 0);
        $dueDate = $tpl['due_date'];
        $repeatRule = $tpl['repeat_rule'];
        $storeName = $tpl['store_name'];
        
        // 2. Calculate next due date
        $nextDate = calculateNextDueDate($dueDate, $repeatRule);
        if (!$nextDate) {
            $stats['errors'][] = "Cannot calculate next date for bill#{$tplId}";
            continue;
        }
        
        // 3. Check if bill already exists for that month+store+title
        $nextMonth = (int)date('m', strtotime($nextDate));
        $nextYear = (int)date('Y', strtotime($nextDate));
        
        $existing = $db->fetch("
            SELECT id FROM bills
            WHERE title = " . $pdo->quote($title) . "
            AND store_id = {$storeId}
            AND MONTH(due_date) = {$nextMonth}
            AND YEAR(due_date) = {$nextYear}
            AND (is_archived = 0 OR is_archived IS NULL)
            LIMIT 1
        ");
        
        if ($existing) {
            $stats['skipped_existing']++;
            continue;
        }
        
        // 4. Insert new recurring bill
        $escapedTitle = $pdo->quote($title);
        $escapedRepeat = $pdo->quote($repeatRule);
        
        $db->exec("
            INSERT INTO bills (title, store_id, amount, due_date, repeat_rule, category, status, is_archived, created_at)
            VALUES ({$escapedTitle}, {$storeId}, {$amount}, '{$nextDate}', {$escapedRepeat}, " . $pdo->quote($tpl['category'] ?? '') . ", '', 0, NOW())
        ");
        
        $newBillId = $db->lastInsertId();
        $stats['bills_generated']++;
        
        // 5. Log to history
        if ($db->tableExists('recurring_bill_history')) {
            $db->exec("
                INSERT INTO recurring_bill_history (template_bill_id, generated_bill_id, recurrence_period, original_due_date, new_due_date, generated_at)
                VALUES ({$tplId}, {$newBillId}, {$escapedRepeat}, '{$dueDate}', '{$nextDate}', NOW())
            ");
        }
    }
    
    echo json_encode($stats);
    
} catch (Exception $e) {
    $stats['errors'][] = $e->getMessage();
    echo json_encode($stats);
}

/**
 * Calculate next due date based on recurrence rule
 * Preserves day-of-month, handles month-end overflow
 */
function calculateNextDueDate($currentDate, $rule) {
    $dt = new DateTime($currentDate);
    $day = (int)$dt->format('d');
    
    switch ($rule) {
        case 'weekly':
            $dt->modify('+7 days');
            break;
        case 'biweekly':
            $dt->modify('+14 days');
            break;
        case 'monthly':
            $dt->modify('+1 month');
            // Handle month-end: if original day > new month days, use last day
            $maxDay = (int)$dt->format('t');
            if ($day > $maxDay) {
                $dt->modify('-' . ($day - $maxDay) . ' days');
            }
            break;
        case 'quarterly':
            $dt->modify('+3 months');
            $maxDay = (int)$dt->format('t');
            if ($day > $maxDay) {
                $dt->modify('-' . ($day - $maxDay) . ' days');
            }
            break;
        case 'semi-annual':
            $dt->modify('+6 months');
            $maxDay = (int)$dt->format('t');
            if ($day > $maxDay) {
                $dt->modify('-' . ($day - $maxDay) . ' days');
            }
            break;
        case 'annual':
        case 'annually':
            $dt->modify('+1 year');
            $maxDay = (int)$dt->format('t');
            if ($day > $maxDay) {
                $dt->modify('-' . ($day - $maxDay) . ' days');
            }
            break;
        default:
            return null;
    }
    
    return $dt->format('Y-m-d');
}
