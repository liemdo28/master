<?php
/**
 * Admin Incidents - Create Page
 */
$pageTitle = 'Report New Incident';
?>

<div class="p-6">
    <!-- Breadcrumb -->
    <div class="mb-4">
        <a href="/admin/incidents" class="text-blue-600 hover:text-blue-800">&larr; Back to Incidents</a>
    </div>

    <div class="max-w-2xl mx-auto">
        <div class="bg-white rounded-lg shadow">
            <div class="px-6 py-4 border-b">
                <h1 class="text-xl font-bold text-gray-900">Report New Incident</h1>
                <p class="text-sm text-gray-500 mt-1">Document an operational issue that needs attention</p>
            </div>

            <form action="/admin/incidents" method="POST" enctype="multipart/form-data" class="p-6 space-y-6">
                <!-- Title -->
                <div>
                    <label for="title" class="block text-sm font-medium text-gray-700 mb-1">
                        Incident Title <span class="text-red-500">*</span>
                    </label>
                    <input type="text" id="title" name="title" required
                           placeholder="Brief description of the incident"
                           class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                </div>

                <!-- Description -->
                <div>
                    <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
                        Description
                    </label>
                    <textarea id="description" name="description" rows="5"
                              placeholder="Provide detailed information about the incident..."
                              class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
                </div>

                <!-- Grid: Severity & Store -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Severity -->
                    <div>
                        <label for="severity" class="block text-sm font-medium text-gray-700 mb-1">
                            Severity <span class="text-red-500">*</span>
                        </label>
                        <select id="severity" name="severity" required
                                class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="low">Low - Minor issue, no immediate impact</option>
                            <option value="medium" selected>Medium - Moderate impact, needs attention</option>
                            <option value="high">High - Significant impact on operations</option>
                            <option value="critical">Critical - Emergency, immediate response required</option>
                        </select>
                    </div>

                    <!-- Store -->
                    <div>
                        <label for="store_id" class="block text-sm font-medium text-gray-700 mb-1">
                            Store
                        </label>
                        <select id="store_id" name="store_id"
                                class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="">-- Select Store --</option>
                            <?php foreach ($stores as $store): ?>
                                <option value="<?= $store['id'] ?>"><?= htmlspecialchars($store['name']) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                </div>

                <!-- Grid: Category & Assign -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Category -->
                    <div>
                        <label for="category" class="block text-sm font-medium text-gray-700 mb-1">
                            Category
                        </label>
                        <select id="category" name="category"
                                class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="">-- Select Category --</option>
                            <option value="equipment">Equipment Failure</option>
                            <option value="safety">Safety Issue</option>
                            <option value="staffing">Staffing Problem</option>
                            <option value="customer">Customer Complaint</option>
                            <option value="maintenance">Maintenance</option>
                            <option value="compliance">Compliance Violation</option>
                            <option value="security">Security Incident</option>
                            <option value="financial">Financial Issue</option>
                            <option value="operational">Operational</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    <!-- Assign To -->
                    <div>
                        <label for="assigned_to" class="block text-sm font-medium text-gray-700 mb-1">
                            Assign To
                        </label>
                        <select id="assigned_to" name="assigned_to"
                                class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="">-- Assign To --</option>
                            <?php foreach ($users as $user): ?>
                                <option value="<?= $user['id'] ?>"><?= htmlspecialchars($user['name']) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                </div>

                <!-- Impact -->
                <div>
                    <label for="impact" class="block text-sm font-medium text-gray-700 mb-1">
                        Impact
                    </label>
                    <input type="text" id="impact" name="impact"
                           placeholder="e.g., Affects 50 customers, $500 revenue loss"
                           class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                </div>

                <!-- Attachments -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        Attachments
                    </label>
                    <div class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg">
                        <div class="space-y-1 text-center">
                            <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <div class="flex text-sm text-gray-600 justify-center">
                                <label for="attachments" class="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                                    <span>Upload files</span>
                                    <input id="attachments" name="attachments[]" type="file" multiple class="sr-only">
                                </label>
                                <p class="pl-1">or drag and drop</p>
                            </div>
                            <p class="text-xs text-gray-500">PNG, JPG, PDF up to 10MB</p>
                        </div>
                    </div>
                </div>

                <!-- Actions -->
                <div class="flex justify-end gap-3 pt-4 border-t">
                    <a href="/admin/incidents" class="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                        Cancel
                    </a>
                    <button type="submit" class="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                        Report Incident
                    </button>
                </div>
            </form>
        </div>
    </div>
</div>
