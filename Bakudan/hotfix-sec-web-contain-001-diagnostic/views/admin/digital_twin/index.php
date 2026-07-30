<?php
/**
 * Digital Twin UI - Simulation & Impact Visualization
 */
$currentPage = 'admin-digital-twin';
$pageTitle = 'Digital Twin';
ob_start();

$db = Database::getInstance();
$totalTasks = (int)($db->fetch("SELECT COUNT(*) as cnt FROM tasks WHERE is_completed = 0")['cnt'] ?? 0);
$totalEmployees = (int)($db->fetch("SELECT COUNT(*) as cnt FROM users WHERE is_active = 1")['cnt'] ?? 0);
$totalStores = (int)($db->fetch("SELECT COUNT(*) as cnt FROM stores")['cnt'] ?? 0);
$monthlyBills = (float)($db->fetch("SELECT COALESCE(SUM(amount),0) as total FROM bills WHERE due_date >= DATE_FORMAT(NOW(),'%Y-%m-01')")['total'] ?? 0);
?>
<div class="p-6">
    <div class="flex justify-between items-center mb-6">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">Digital Twin</h1>
            <p class="text-gray-600 mt-1">Business simulation & impact analysis</p>
        </div>
    </div>

    <!-- Current State -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div class="text-2xl font-bold text-blue-600"><?= $totalTasks ?></div>
            <div class="text-sm text-gray-500">Active Tasks</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div class="text-2xl font-bold text-green-600"><?= $totalEmployees ?></div>
            <div class="text-sm text-gray-500">Employees</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <div class="text-2xl font-bold text-purple-600"><?= $totalStores ?></div>
            <div class="text-sm text-gray-500">Stores</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
            <div class="text-2xl font-bold text-orange-600">$<?= number_format($monthlyBills, 0) ?></div>
            <div class="text-sm text-gray-500">Monthly Bills</div>
        </div>
    </div>

    <!-- Simulation Panel -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Scenario Selector -->
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Run Simulation</h2>
            <form id="simulation-form" onsubmit="runSimulation(event)">
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Scenario</label>
                    <select id="scenario" class="w-full px-3 py-2 border rounded-lg">
                        <option value="overtime_increase">What if overtime increases 20%?</option>
                        <option value="store_close">What if 1 store closes?</option>
                        <option value="employee_quit">What if 2 employees quit?</option>
                        <option value="demand_spike">What if demand spikes 30%?</option>
                        <option value="supply_delay">What if supply is delayed 2 weeks?</option>
                        <option value="new_store">What if we open a new store?</option>
                    </select>
                </div>
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Impact Factor</label>
                    <input type="range" id="impact-factor" min="10" max="100" value="50" class="w-full" oninput="document.getElementById('factor-val').textContent=this.value+'%'">
                    <span id="factor-val" class="text-sm text-gray-500">50%</span>
                </div>
                <button type="submit" class="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                    ▶ Run Simulation
                </button>
            </form>
        </div>

        <!-- Results Panel -->
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Impact Analysis</h2>
            <div id="simulation-results">
                <div class="text-center py-8 text-gray-400">
                    <div class="text-4xl mb-2">🔮</div>
                    <p>Select a scenario and run simulation</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Impact Visualization -->
    <div class="bg-white rounded-lg shadow p-6 mt-6" id="impact-viz" style="display:none">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Impact Breakdown</h2>
        <div class="space-y-4">
            <div>
                <div class="flex justify-between text-sm mb-1"><span>Financial Impact</span><span id="fin-val">—</span></div>
                <div class="w-full bg-gray-200 rounded-full h-3"><div id="fin-bar" class="bg-red-500 h-3 rounded-full transition-all" style="width:0%"></div></div>
            </div>
            <div>
                <div class="flex justify-between text-sm mb-1"><span>Operational Impact</span><span id="ops-val">—</span></div>
                <div class="w-full bg-gray-200 rounded-full h-3"><div id="ops-bar" class="bg-orange-500 h-3 rounded-full transition-all" style="width:0%"></div></div>
            </div>
            <div>
                <div class="flex justify-between text-sm mb-1"><span>Service Impact</span><span id="svc-val">—</span></div>
                <div class="w-full bg-gray-200 rounded-full h-3"><div id="svc-bar" class="bg-yellow-500 h-3 rounded-full transition-all" style="width:0%"></div></div>
            </div>
            <div>
                <div class="flex justify-between text-sm mb-1"><span>Team Impact</span><span id="team-val">—</span></div>
                <div class="w-full bg-gray-200 rounded-full h-3"><div id="team-bar" class="bg-blue-500 h-3 rounded-full transition-all" style="width:0%"></div></div>
            </div>
        </div>
    </div>
</div>

<script>
function runSimulation(e) {
    e.preventDefault();
    const scenario = document.getElementById('scenario').value;
    const factor = parseInt(document.getElementById('impact-factor').value);
    
    const impacts = {
        overtime_increase: {fin: 65, ops: 40, svc: 20, team: 70, desc: 'Overtime costs increase significantly, team burnout risk rises'},
        store_close: {fin: 80, ops: 90, svc: 60, team: 50, desc: 'Major revenue loss, operations disrupted, customers affected'},
        employee_quit: {fin: 30, ops: 55, svc: 45, team: 75, desc: 'Hiring costs, knowledge loss, remaining team overloaded'},
        demand_spike: {fin: 20, ops: 70, svc: 50, team: 60, desc: 'Revenue opportunity but strain on operations and team'},
        supply_delay: {fin: 40, ops: 65, svc: 55, team: 30, desc: 'Menu items unavailable, customer satisfaction drops'},
        new_store: {fin: 70, ops: 50, svc: 30, team: 45, desc: 'High upfront cost, management attention divided'},
    };
    
    const impact = impacts[scenario] || impacts.overtime_increase;
    const scale = factor / 100;
    
    document.getElementById('simulation-results').innerHTML = `
        <div class="space-y-3">
            <div class="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p class="text-sm text-yellow-800 font-medium">⚡ ${impact.desc}</p>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div class="p-3 bg-red-50 rounded"><span class="text-xs text-gray-500">Financial Risk</span><div class="text-lg font-bold text-red-600">${Math.round(impact.fin * scale)}%</div></div>
                <div class="p-3 bg-orange-50 rounded"><span class="text-xs text-gray-500">Ops Risk</span><div class="text-lg font-bold text-orange-600">${Math.round(impact.ops * scale)}%</div></div>
                <div class="p-3 bg-yellow-50 rounded"><span class="text-xs text-gray-500">Service Risk</span><div class="text-lg font-bold text-yellow-600">${Math.round(impact.svc * scale)}%</div></div>
                <div class="p-3 bg-blue-50 rounded"><span class="text-xs text-gray-500">Team Risk</span><div class="text-lg font-bold text-blue-600">${Math.round(impact.team * scale)}%</div></div>
            </div>
        </div>`;
    
    document.getElementById('impact-viz').style.display = 'block';
    document.getElementById('fin-bar').style.width = Math.round(impact.fin * scale) + '%';
    document.getElementById('fin-val').textContent = Math.round(impact.fin * scale) + '%';
    document.getElementById('ops-bar').style.width = Math.round(impact.ops * scale) + '%';
    document.getElementById('ops-val').textContent = Math.round(impact.ops * scale) + '%';
    document.getElementById('svc-bar').style.width = Math.round(impact.svc * scale) + '%';
    document.getElementById('svc-val').textContent = Math.round(impact.svc * scale) + '%';
    document.getElementById('team-bar').style.width = Math.round(impact.team * scale) + '%';
    document.getElementById('team-val').textContent = Math.round(impact.team * scale) + '%';
}
</script>
<?php
$content = ob_get_clean();
require __DIR__ . '/../../layouts/main.php';
