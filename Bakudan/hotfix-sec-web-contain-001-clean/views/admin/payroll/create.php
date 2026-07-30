<?php
/**
 * Admin Payroll - Create Page
 */
$pageTitle = 'New Payroll Run';
?>

<div class="p-6">
    <div class="mb-4">
        <a href="/admin/payroll" class="text-blue-600 hover:text-blue-800">&larr; Back to Payroll</a>
    </div>

    <div class="max-w-2xl mx-auto">
        <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b">
                <h1 class="text-xl font-bold text-gray-900">New Payroll Run</h1>
                <p class="text-sm text-gray-500 mt-1">Create a new payroll period for processing</p>
            </div>

            <form action="/admin/payroll" method="POST" class="p-6 space-y-6">
                <div class="grid grid-cols-2 gap-6">
                    <div>
                        <label for="period_start" class="block text-sm font-medium text-gray-700 mb-1">
                            Period Start <span class="text-red-500">*</span>
                        </label>
                        <input type="date" id="period_start" name="period_start" required
                               value="<?= date('Y-m-01') ?>"
                               class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500">
                    </div>
                    <div>
                        <label for="period_end" class="block text-sm font-medium text-gray-700 mb-1">
                            Period End <span class="text-red-500">*</span>
                        </label>
                        <input type="date" id="period_end" name="period_end" required
                               value="<?= date('Y-m-t') ?>"
                               class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500">
                    </div>
                </div>

                <div>
                    <label for="notes" class="block text-sm font-medium text-gray-700 mb-1">
                        Notes
                    </label>
                    <textarea id="notes" name="notes" rows="3"
                              placeholder="Optional notes for this payroll run..."
                              class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"></textarea>
                </div>

                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 class="font-medium text-blue-900 mb-2">What happens next?</h3>
                    <ol class="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                        <li>Payroll run will be created as "Draft"</li>
                        <li>Click "Process" to calculate payments for all active employees</li>
                        <li>Review and adjust individual payments if needed</li>
                        <li>Click "Complete" to finalize the payroll run</li>
                    </ol>
                </div>

                <div class="flex justify-end gap-3 pt-4 border-t">
                    <a href="/admin/payroll" class="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                        Cancel
                    </a>
                    <button type="submit" class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                        Create Payroll Run
                    </button>
                </div>
            </form>
        </div>
    </div>
</div>
