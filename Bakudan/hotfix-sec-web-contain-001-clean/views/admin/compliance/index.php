<?php
/**
 * Compliance Center - Filing Calendar & Risk Assessment
 */
$currentPage = 'admin-compliance';
$pageTitle = 'Compliance';
ob_start();

$db = Database::getInstance();
$today = date('Y-m-d');

// Upcoming compliance deadlines from bills
$filings = $db->fetchAll("
    SELECT id, vendor, amount, due_date, status, category
    FROM bills
    WHERE (category IN ('tax','payroll','compliance','license')
           OR vendor LIKE '%CDTFA%' OR vendor LIKE '%IRS%' OR vendor LIKE '%EDD%' OR vendor LIKE '%FTB%' OR vendor LIKE '%Franchise Tax%')
    AND status IN ('pending','overdue')
    ORDER BY due_date ASC
    LIMIT 20
");

$overdueFilings = array_filter($filings, fn($f) => $f['due_date'] < $today);
$upcomingFilings = array_filter($filings, fn($f) => $f['due_date'] >= $today);
?>
<div class="p-6">
    <div class="flex justify-between items-center mb-6">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">Compliance Center</h1>
            <p class="text-gray-600 mt-1">Filing deadlines, risk assessment & compliance tracking</p>
        </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <div class="text-2xl font-bold text-red-600"><?= count($overdueFilings) ?></div>
            <div class="text-sm text-gray-500">Overdue Filings</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div class="text-2xl font-bold text-yellow-600"><?= count($upcomingFilings) ?></div>
            <div class="text-sm text-gray-500">Upcoming</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div class="text-2xl font-bold text-green-600"><?= count($overdueFilings) === 0 ? '✓' : '!' ?></div>
            <div class="text-sm text-gray-500">Risk Level</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div class="text-2xl font-bold text-blue-600"><?= count($filings) ?></div>
            <div class="text-sm text-gray-500">Total Filings</div>
        </div>
    </div>

    <?php if (!empty($overdueFilings)): ?>
    <!-- Overdue Alert -->
    <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <h3 class="font-semibold text-red-800 mb-2">⚠️ Overdue Filings</h3>
        <div class="space-y-2">
            <?php foreach ($overdueFilings as $f): ?>
                <div class="flex justify-between items-center text-sm">
                    <span class="text-red-700"><?= e($f['vendor']) ?> — $<?= number_format($f['amount'], 2) ?></span>
                    <span class="text-red-600 font-medium">Due: <?= date('M d', strtotime($f['due_date'])) ?></span>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
    <?php endif; ?>

    <!-- Filing Calendar -->
    <div class="bg-white rounded-lg shadow mb-6">
        <div class="p-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">Filing Calendar</h2>
        </div>
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Filing</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
                <?php if (empty($filings)): ?>
                    <tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">No compliance filings found</td></tr>
                <?php else: ?>
                    <?php foreach ($filings as $f):
                        $isOverdue = $f['due_date'] < $today;
                        $statusColor = $isOverdue ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700';
                    ?>
                        <tr class="hover:bg-gray-50">
                            <td class="px-4 py-3 text-sm font-medium"><?= e($f['vendor']) ?></td>
                            <td class="px-4 py-3 text-sm text-gray-600"><?= e($f['category'] ?? '—') ?></td>
                            <td class="px-4 py-3 text-sm">$<?= number_format($f['amount'], 2) ?></td>
                            <td class="px-4 py-3 text-sm <?= $isOverdue ? 'text-red-600 font-medium' : 'text-gray-600' ?>">
                                <?= date('M d, Y', strtotime($f['due_date'])) ?>
                            </td>
                            <td class="px-4 py-3">
                                <span class="px-2 py-1 text-xs font-semibold rounded-full <?= $statusColor ?>">
                                    <?= $isOverdue ? 'OVERDUE' : ucfirst($f['status']) ?>
                                </span>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
    </div>

    <!-- Compliance Checklist -->
    <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Compliance Checklist</h2>
        <div class="space-y-3">
            <?php
            $checklist = [
                ['Business License', 'Annual renewal', count($overdueFilings) === 0],
                ['Health Permit', 'Annual inspection', true],
                ['Food Handler Certificates', 'All staff current', true],
                ['Tax Filings (CDTFA)', 'Quarterly', count(array_filter($overdueFilings, fn($f) => str_contains($f['vendor'], 'CDTFA'))) === 0],
                ['Payroll Tax (EDD)', 'Quarterly', count(array_filter($overdueFilings, fn($f) => str_contains($f['vendor'], 'EDD'))) === 0],
                ['Workers Comp Insurance', 'Annual', true],
                ['Fire Safety Inspection', 'Annual', true],
            ];
            foreach ($checklist as [$name, $freq, $ok]):
            ?>
                <div class="flex items-center gap-3 p-3 rounded <?= $ok ? 'bg-green-50' : 'bg-red-50' ?>">
                    <span class="text-lg"><?= $ok ? '✅' : '❌' ?></span>
                    <div class="flex-1">
                        <div class="text-sm font-medium <?= $ok ? 'text-green-800' : 'text-red-800' ?>"><?= $name ?></div>
                        <div class="text-xs text-gray-500"><?= $freq ?></div>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
</div>
<?php
$content = ob_get_clean();
require __DIR__ . '/../../layouts/main.php';
