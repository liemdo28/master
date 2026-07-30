<?php

require_once __DIR__ . '/../service/OpenAIService.php';

class AiTaskController
{
    private $projectModel;
    private $taskModel;
    private $storeModel;
    private $billModel;
    private $vendorModel;

    public function __construct()
    {
        $this->projectModel = new Project();
        $this->taskModel = new Task();
        $this->storeModel = new Store();
        $this->billModel = new Bill();
        $this->vendorModel = new Vendor();
    }

    public function index()
    {
        $pageTitle = t('ai_import.mode_title');
        $currentPage = 'projects';
        require __DIR__ . '/../views/ai_import/index.php';
    }

    public function storeIndex()
    {
        $stores = $this->storeModel->allActive();
        $pageTitle = t('ai_import.store_mode_title');
        $currentPage = 'projects';
        $selectionTitle = t('ai_import.store_mode_title');
        $selectionDesc = t('ai_import.store_mode_desc');
        $createAction = APP_URL . '/ai-import/store/create';
        $selectBase = APP_URL . '/ai-import/store/';
        $headerActions = '<a href="' . APP_URL . '/ai-import" class="btn btn-outline btn-sm">' . e(t('common.back')) . '</a>';
        require __DIR__ . '/../views/ai_import/store_select.php';
    }

    public function billIndex()
    {
        $stores = $this->storeModel->allActive();
        $pageTitle = t('ai_import.bill_mode_title');
        $currentPage = 'bills';
        $selectionTitle = t('ai_import.bill_mode_title');
        $selectionDesc = t('ai_import.bill_mode_desc');
        $createAction = APP_URL . '/ai-import/bills/store/create';
        $selectBase = APP_URL . '/ai-import/bills/';
        $headerActions = '<a href="' . APP_URL . '/ai-import" class="btn btn-outline btn-sm">' . e(t('common.back')) . '</a>';
        require __DIR__ . '/../views/ai_import/store_select.php';
    }

    public function createStoreForProjects()
    {
        $storeId = $this->createStoreFromRequest('ai-import/store');
        redirect('ai-import/store/' . $storeId);
    }

    public function createStoreForBills()
    {
        $storeId = $this->createStoreFromRequest('ai-import/bills');
        redirect('ai-import/bills/' . $storeId);
    }

    public function storeProjects($storeId)
    {
        $store = $this->loadStoreContext($storeId);
        $projects = $this->projectModel->getByStore($storeId, canAdmin() ? null : $_SESSION['user_id']);
        $pageTitle = t('ai_import.store_mode_title');
        $currentPage = 'projects';
        $headerActions = '<a href="' . APP_URL . '/ai-import/store" class="btn btn-outline btn-sm">' . e(t('common.back')) . '</a>';
        require __DIR__ . '/../views/ai_import/store_projects.php';
    }

    public function createProjectForStore($storeId)
    {
        $store = $this->loadStoreContext($storeId);
        $name = trim($_POST['name'] ?? '');
        if ($name === '') {
            flash('error', t('ai_import.project_name_required'));
            redirect('ai-import/store/' . $storeId);
        }

        $projectId = $this->projectModel->create([
            'name' => $name,
            'description' => trim($_POST['description'] ?? ''),
            'color' => trim($_POST['color'] ?? ($store['color'] ?: '#DC2626')),
            'owner_id' => $_SESSION['user_id'],
            'store_id' => $storeId,
        ]);

        flash('success', t('ai_import.project_created'));
        redirect('projects/' . $projectId . '/ai-import');
    }

    public function billImport($storeId)
    {
        $store = $this->loadStoreContext($storeId);
        $preview = $this->getBillPreview($storeId);
        $isConfigured = openai_is_configured();
        $configDebug = openai_config_debug();
        $pageTitle = t('ai_import.bill_mode_title');
        $currentPage = 'bills';
        $headerActions = '<a href="' . APP_URL . '/ai-import/bills" class="btn btn-outline btn-sm">' . e(t('common.back')) . '</a>';
        require __DIR__ . '/../views/ai_import/bill_import.php';
    }

    public function analyzeBill($storeId)
    {
        $store = $this->loadStoreContext($storeId);
        if (!openai_is_configured()) {
            flash('error', t('ai_import.missing_key'));
            redirect('ai-import/bills/' . $storeId);
        }

        if (empty($_FILES['document']) || $_FILES['document']['error'] !== UPLOAD_ERR_OK) {
            flash('error', t('ai_import.upload_required'));
            redirect('ai-import/bills/' . $storeId);
        }

        $upload = $_FILES['document'];
        if (($upload['size'] ?? 0) > MAX_UPLOAD_SIZE) {
            flash('error', t('ai_import.file_too_large'));
            redirect('ai-import/bills/' . $storeId);
        }

        $originalName = trim((string) ($upload['name'] ?? 'document'));
        $mimeType = $this->detectMimeType($upload['tmp_name'], $originalName);
        if (!$this->isAllowedMimeType($mimeType, $originalName)) {
            flash('error', t('ai_import.unsupported_file'));
            redirect('ai-import/bills/' . $storeId);
        }

        $this->clearBillPreview($storeId);
        $stored = null;

        try {
            $stored = $this->storeUploadedFile($upload['tmp_name'], $originalName);
            $service = new OpenAIService();
            $result = $service->extractBillFromDocument($stored['path'], $originalName, $mimeType, [
                'store' => $store,
                'vendors' => $this->vendorModel->getAllActive(),
            ]);

            $preview = [
                'summary' => trim((string) ($result['summary'] ?? '')),
                'warnings' => array_values(array_filter(array_map(function ($warning) {
                    return trim((string) $warning);
                }, $result['warnings'] ?? []))),
                'bill' => $this->mapSuggestedBill($result['bill'] ?? [], $store),
                'file' => [
                    'original_name' => $originalName,
                    'stored_path' => $stored['path'],
                    'mime_type' => $mimeType,
                    'size' => (int) ($upload['size'] ?? 0),
                ],
                'analyzed_at' => date('Y-m-d H:i:s'),
            ];

            $this->saveBillPreview($storeId, $preview);
            flash('success', t('ai_import.bill_analysis_done'));
        } catch (Exception $e) {
            if (!empty($stored['path']) && is_file($stored['path'])) {
                @unlink($stored['path']);
            }
            flash('error', t('ai_import.analysis_failed', ['message' => $e->getMessage()]));
        }

        redirect('ai-import/bills/' . $storeId);
    }

    public function saveBill($storeId)
    {
        $store = $this->loadStoreContext($storeId);
        $preview = $this->getBillPreview($storeId);
        if (!$preview || empty($preview['bill'])) {
            flash('error', t('ai_import.no_preview'));
            redirect('ai-import/bills/' . $storeId);
        }

        $bill = $this->buildBillFromRequest($_POST['bill'] ?? [], $preview['bill'], $store);
        if ($bill['title'] === '' || empty($bill['due_date'])) {
            flash('error', t('ai_import.bill_required'));
            redirect('ai-import/bills/' . $storeId);
        }

        $sourceName = $preview['file']['original_name'] ?? 'document';
        $sourceFooter = t('ai_import.source_note', ['file' => $sourceName]);
        $sourceExcerpt = trim((string) ($bill['source_excerpt'] ?? ''));
        if ($sourceExcerpt !== '') {
            $sourceFooter .= "\n" . t('ai_import.source_excerpt', ['excerpt' => $sourceExcerpt]);
        }
        $bill['note'] = trim((string) ($bill['note'] ?? ''));
        $bill['note'] = $bill['note'] === ''
            ? $sourceFooter
            : $bill['note'] . "\n\n---\n" . $sourceFooter;

        $vendorId = null;
        if ($bill['vendor_name'] !== '') {
            $vendorId = $this->vendorModel->createOrGet([
                'name' => $bill['vendor_name'],
                'payment_url' => null,
                'login_info' => null,
                'notes' => null,
            ]);
        }

        $existing = $this->billModel->findByStoreTitleDueDate($storeId, $bill['title'], $bill['due_date']);
        $payload = [
            'store_id' => $storeId,
            'title' => $bill['title'],
            'vendor' => $bill['vendor_name'] !== '' ? $bill['vendor_name'] : null,
            'vendor_id' => $vendorId,
            'amount' => $bill['amount'],
            'due_date' => $bill['due_date'],
            'status' => $bill['status'],
            'note' => $bill['note'],
            'color' => $bill['color'] ?: ($store['color'] ?: null),
        ];

        if ($existing) {
            $this->billModel->update($existing['id'], $payload);
            $billId = (int) $existing['id'];
            $messageKey = 'ai_import.bill_updated';
        } else {
            $billId = $this->billModel->create($payload);
            $messageKey = 'ai_import.bill_created';
        }

        $this->attachStoredFileToBill($billId, $preview['file'] ?? []);
        $this->clearBillPreview($storeId);
        flash('success', t($messageKey));
        redirect('bills/store/' . $storeId);
    }

    public function discardBill($storeId)
    {
        $this->loadStoreContext($storeId);
        $this->clearBillPreview($storeId);
        flash('success', t('ai_import.discarded'));
        redirect('ai-import/bills/' . $storeId);
    }

    public function show($projectId)
    {
        [$project, $sections, $members] = $this->loadProjectContext($projectId);
        $pageTitle = t('ai_import.project_page_title', ['project' => $project['name'] ?? '']);
        $currentPage = 'projects';
        $preview = $this->getTaskPreview($projectId);
        $isConfigured = openai_is_configured();
        $configDebug = openai_config_debug();
        $backUrl = !empty($project['store_id'])
            ? APP_URL . '/ai-import/store/' . $project['store_id']
            : APP_URL . '/ai-import/store';
        $headerActions = '<a href="' . $backUrl . '" class="btn btn-outline btn-sm">' . e(t('common.back')) . '</a>';
        require __DIR__ . '/../views/projects/ai_import.php';
    }

    public function analyze($projectId)
    {
        [$project, $sections, $members] = $this->loadProjectContext($projectId);

        if (!openai_is_configured()) {
            flash('error', t('ai_import.missing_key'));
            redirect('projects/' . $projectId . '/ai-import');
        }

        if (empty($_FILES['document']) || $_FILES['document']['error'] !== UPLOAD_ERR_OK) {
            flash('error', t('ai_import.upload_required'));
            redirect('projects/' . $projectId . '/ai-import');
        }

        $upload = $_FILES['document'];
        if (($upload['size'] ?? 0) > MAX_UPLOAD_SIZE) {
            flash('error', t('ai_import.file_too_large'));
            redirect('projects/' . $projectId . '/ai-import');
        }

        $originalName = trim((string) ($upload['name'] ?? 'document'));
        $mimeType = $this->detectMimeType($upload['tmp_name'], $originalName);
        if (!$this->isAllowedMimeType($mimeType, $originalName)) {
            flash('error', t('ai_import.unsupported_file'));
            redirect('projects/' . $projectId . '/ai-import');
        }

        $this->clearTaskPreview($projectId);

        $stored = null;
        try {
            $stored = $this->storeUploadedFile($upload['tmp_name'], $originalName);
            $service = new OpenAIService();
            $result = $service->extractTasksFromDocument($stored['path'], $originalName, $mimeType, [
                'project' => $project,
                'sections' => $sections,
                'members' => $members,
            ]);

            $previewTasks = [];
            foreach ($result['tasks'] ?? [] as $task) {
                $mapped = $this->mapSuggestedTask($task, $sections, $members);
                if ($mapped !== null) {
                    $previewTasks[] = $mapped;
                }
            }

            $preview = [
                'summary' => trim((string) ($result['summary'] ?? '')),
                'warnings' => array_values(array_filter(array_map(function ($warning) {
                    return trim((string) $warning);
                }, $result['warnings'] ?? []))),
                'tasks' => $previewTasks,
                'file' => [
                    'original_name' => $originalName,
                    'stored_path' => $stored['path'],
                    'mime_type' => $mimeType,
                    'size' => (int) ($upload['size'] ?? 0),
                ],
                'analyzed_at' => date('Y-m-d H:i:s'),
            ];

            $this->saveTaskPreview($projectId, $preview);
            flash('success', t('ai_import.analysis_done', ['count' => count($previewTasks)]));
        } catch (Exception $e) {
            if (!empty($stored['path']) && is_file($stored['path'])) {
                @unlink($stored['path']);
            }
            flash('error', t('ai_import.analysis_failed', ['message' => $e->getMessage()]));
        }

        redirect('projects/' . $projectId . '/ai-import');
    }

    public function create($projectId)
    {
        [$project, $sections, $members] = $this->loadProjectContext($projectId);
        $preview = $this->getTaskPreview($projectId);
        $tasks = $preview['tasks'] ?? [];

        if (!$preview || empty($tasks)) {
            flash('error', t('ai_import.no_preview'));
            redirect('projects/' . $projectId . '/ai-import');
        }

        $tasks = $this->buildTasksFromRequest($_POST['tasks'] ?? [], $tasks, $sections, $members);
        if (empty($tasks)) {
            flash('error', t('ai_import.no_selected_tasks'));
            redirect('projects/' . $projectId . '/ai-import');
        }

        $createdCount = 0;
        $sourceName = $preview['file']['original_name'] ?? 'document';

        foreach ($tasks as $task) {
            $description = trim((string) ($task['description'] ?? ''));
            $excerpt = trim((string) ($task['source_excerpt'] ?? ''));
            $sourceFooter = t('ai_import.source_note', ['file' => $sourceName]);
            if ($excerpt !== '') {
                $sourceFooter .= "\n" . t('ai_import.source_excerpt', ['excerpt' => $excerpt]);
            }
            if ($description === '') {
                $description = $sourceFooter;
            } else {
                $description .= "\n\n---\n" . $sourceFooter;
            }

            $taskId = $this->taskModel->create([
                'project_id' => $projectId,
                'section_id' => $task['section_id'] ?: null,
                'title' => $task['title'],
                'description' => $description,
                'assignee_id' => $task['assignee_id'] ?: null,
                'priority' => $task['priority'],
                'status' => $task['status'],
                'due_date' => $task['due_date'] ?: null,
                'start_date' => $task['start_date'] ?: null,
                'created_by' => $_SESSION['user_id'],
            ]);

            if (!empty($task['assignee_id']) && (int) $task['assignee_id'] !== (int) $_SESSION['user_id']) {
                notifyUser([
                    'user_id' => $task['assignee_id'],
                    'type' => 'task_assigned',
                    'title' => t('notif.task_assigned'),
                    'message' => $task['title'] . ' — ' . ($project['name'] ?? ''),
                    'task_id' => $taskId,
                    'project_id' => $projectId,
                    'from_user_id' => $_SESSION['user_id'],
                ]);
            }

            $createdCount++;
        }

        $this->clearTaskPreview($projectId);
        flash('success', t('ai_import.created_success', ['count' => $createdCount]));
        redirect('projects/' . $projectId);
    }

    public function discard($projectId)
    {
        $this->loadProjectContext($projectId);
        $this->clearTaskPreview($projectId);
        flash('success', t('ai_import.discarded'));
        redirect('projects/' . $projectId . '/ai-import');
    }

    private function createStoreFromRequest($fallbackPath = 'ai-import')
    {
        $name = trim($_POST['name'] ?? '');
        if ($name === '') {
            flash('error', t('ai_import.store_name_required'));
            redirect($fallbackPath);
        }

        $storeId = $this->storeModel->create([
            'name' => $name,
            'address' => trim($_POST['address'] ?? ''),
            'color' => trim($_POST['color'] ?? ''),
        ]);

        flash('success', t('ai_import.store_created'));
        return $storeId;
    }

    private function loadProjectContext($projectId)
    {
        $project = $this->projectModel->findById($projectId);
        if (!$project) {
            redirect('projects');
        }

        if (!canAdmin() && !$this->projectModel->isMember($projectId, $_SESSION['user_id'])) {
            redirect('projects');
        }

        $sections = $this->projectModel->getSections($projectId);
        $members = $this->projectModel->getMembers($projectId);

        return [$project, $sections, $members];
    }

    private function loadStoreContext($storeId)
    {
        $store = $this->storeModel->find($storeId);
        if (!$store) {
            redirect('ai-import');
        }

        return $store;
    }

    private function getTaskPreview($projectId)
    {
        return $_SESSION['ai_task_import_previews'][$projectId] ?? null;
    }

    private function saveTaskPreview($projectId, array $preview)
    {
        if (!isset($_SESSION['ai_task_import_previews'])) {
            $_SESSION['ai_task_import_previews'] = [];
        }
        $_SESSION['ai_task_import_previews'][$projectId] = $preview;
    }

    private function clearTaskPreview($projectId)
    {
        $preview = $this->getTaskPreview($projectId);
        $this->cleanupPreviewFile($preview['file']['stored_path'] ?? '');
        unset($_SESSION['ai_task_import_previews'][$projectId]);
    }

    private function getBillPreview($storeId)
    {
        return $_SESSION['ai_bill_import_previews'][$storeId] ?? null;
    }

    private function saveBillPreview($storeId, array $preview)
    {
        if (!isset($_SESSION['ai_bill_import_previews'])) {
            $_SESSION['ai_bill_import_previews'] = [];
        }
        $_SESSION['ai_bill_import_previews'][$storeId] = $preview;
    }

    private function clearBillPreview($storeId)
    {
        $preview = $this->getBillPreview($storeId);
        $this->cleanupPreviewFile($preview['file']['stored_path'] ?? '');
        unset($_SESSION['ai_bill_import_previews'][$storeId]);
    }

    private function cleanupPreviewFile($storedPath)
    {
        if ($storedPath && is_file($storedPath)) {
            @unlink($storedPath);
        }
    }

    private function detectMimeType($tmpName, $originalName)
    {
        $mimeType = '';
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            if ($finfo) {
                $mimeType = (string) finfo_file($finfo, $tmpName);
                finfo_close($finfo);
            }
        }

        if ($mimeType === '' && function_exists('mime_content_type')) {
            $mimeType = (string) mime_content_type($tmpName);
        }

        if ($mimeType === '') {
            $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
            $map = [
                'pdf' => 'application/pdf',
                'jpg' => 'image/jpeg',
                'jpeg' => 'image/jpeg',
                'png' => 'image/png',
                'webp' => 'image/webp',
                'gif' => 'image/gif',
            ];
            $mimeType = $map[$ext] ?? 'application/octet-stream';
        }

        return $mimeType;
    }

    private function isAllowedMimeType($mimeType, $originalName)
    {
        $allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (in_array($mimeType, $allowed, true)) {
            return true;
        }

        $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        return in_array($ext, ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif'], true);
    }

    private function storeUploadedFile($tmpName, $originalName)
    {
        $dir = UPLOAD_DIR . 'ai-imports/';
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        $filename = 'ai_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . ($ext ? '.' . $ext : '');
        $target = $dir . $filename;
        if (!move_uploaded_file($tmpName, $target)) {
            throw new RuntimeException('Failed to store uploaded file.');
        }

        return ['path' => $target, 'filename' => $filename];
    }

    private function attachStoredFileToBill($billId, array $file)
    {
        $storedPath = $file['stored_path'] ?? '';
        if ($storedPath === '' || !is_file($storedPath)) {
            return;
        }

        if (!is_dir(UPLOAD_DIR)) {
            mkdir(UPLOAD_DIR, 0755, true);
        }

        $ext = strtolower(pathinfo($file['original_name'] ?? '', PATHINFO_EXTENSION));
        $filename = uniqid() . '_' . time() . ($ext ? '.' . $ext : '');
        $target = UPLOAD_DIR . $filename;
        if (!copy($storedPath, $target)) {
            return;
        }

        $this->billModel->addAttachment([
            'bill_id' => $billId,
            'filename' => $filename,
            'original_name' => $file['original_name'] ?? basename($target),
            'file_size' => filesize($target),
            'mime_type' => $file['mime_type'] ?? null,
        ]);
    }

    private function mapSuggestedTask($task, array $sections, array $members)
    {
        $title = trim((string) ($task['title'] ?? ''));
        if ($title === '') {
            return null;
        }

        $sectionMatch = $this->matchByName((string) ($task['section_name'] ?? ''), $sections);
        $assigneeMatch = $this->matchByName((string) ($task['assignee_name'] ?? ''), $members);

        return [
            'title' => $title,
            'description' => trim((string) ($task['description'] ?? '')),
            'assignee_id' => $assigneeMatch['id'] ?? null,
            'assignee_name' => $assigneeMatch['name'] ?? null,
            'section_id' => $sectionMatch['id'] ?? null,
            'section_name' => $sectionMatch['name'] ?? null,
            'priority' => $this->normalizePriority($task['priority'] ?? 'medium'),
            'status' => $this->normalizeStatus($task['status'] ?? 'todo'),
            'due_date' => $this->normalizeDate($task['due_date'] ?? null),
            'start_date' => $this->normalizeDate($task['start_date'] ?? null),
            'confidence' => $this->normalizeConfidence($task['confidence'] ?? null),
            'source_excerpt' => trim((string) ($task['source_excerpt'] ?? '')),
        ];
    }

    private function buildTasksFromRequest($requestTasks, array $fallbackTasks, array $sections, array $members)
    {
        if (!is_array($requestTasks)) {
            return $fallbackTasks;
        }

        $validSectionIds = array_map(function ($section) { return (int) $section['id']; }, $sections);
        $validMemberIds = array_map(function ($member) { return (int) $member['id']; }, $members);

        $tasks = [];
        foreach ($fallbackTasks as $index => $fallbackTask) {
            $input = $requestTasks[$index] ?? null;
            if (!is_array($input) || empty($input['include'])) {
                continue;
            }

            $title = trim((string) ($input['title'] ?? ''));
            if ($title === '') {
                continue;
            }

            $sectionId = (int) ($input['section_id'] ?? 0);
            $assigneeId = (int) ($input['assignee_id'] ?? 0);

            $tasks[] = [
                'title' => $title,
                'description' => trim((string) ($input['description'] ?? '')),
                'assignee_id' => in_array($assigneeId, $validMemberIds, true) ? $assigneeId : null,
                'section_id' => in_array($sectionId, $validSectionIds, true) ? $sectionId : null,
                'priority' => $this->normalizePriority($input['priority'] ?? 'medium'),
                'status' => $this->normalizeStatus($input['status'] ?? 'todo'),
                'due_date' => $this->normalizeDate($input['due_date'] ?? null),
                'start_date' => $this->normalizeDate($input['start_date'] ?? null),
                'source_excerpt' => trim((string) ($input['source_excerpt'] ?? ($fallbackTask['source_excerpt'] ?? ''))),
            ];
        }

        return $tasks;
    }

    private function mapSuggestedBill($bill, array $store)
    {
        return [
            'title' => trim((string) ($bill['title'] ?? '')),
            'vendor_name' => trim((string) ($bill['vendor_name'] ?? '')),
            'amount' => $this->normalizeAmount($bill['amount'] ?? null),
            'due_date' => $this->normalizeDate($bill['due_date'] ?? null),
            'status' => $this->normalizeBillStatus($bill['status'] ?? 'pending'),
            'note' => trim((string) ($bill['note'] ?? '')),
            'color' => $this->normalizeColor($bill['color'] ?? null) ?: ($store['color'] ?? null),
            'confidence' => $this->normalizeConfidence($bill['confidence'] ?? null),
            'source_excerpt' => trim((string) ($bill['source_excerpt'] ?? '')),
        ];
    }

    private function buildBillFromRequest($input, array $fallback, array $store)
    {
        return [
            'title' => trim((string) ($input['title'] ?? $fallback['title'] ?? '')),
            'vendor_name' => trim((string) ($input['vendor_name'] ?? $fallback['vendor_name'] ?? '')),
            'amount' => $this->normalizeAmount($input['amount'] ?? ($fallback['amount'] ?? null)),
            'due_date' => $this->normalizeDate($input['due_date'] ?? ($fallback['due_date'] ?? null)),
            'status' => $this->normalizeBillStatus($input['status'] ?? ($fallback['status'] ?? 'pending')),
            'note' => trim((string) ($input['note'] ?? $fallback['note'] ?? '')),
            'color' => $this->normalizeColor($input['color'] ?? ($fallback['color'] ?? null)) ?: ($store['color'] ?? null),
            'source_excerpt' => trim((string) ($input['source_excerpt'] ?? ($fallback['source_excerpt'] ?? ''))),
        ];
    }

    private function matchByName($candidate, array $items)
    {
        $candidate = trim((string) $candidate);
        if ($candidate === '') {
            return null;
        }

        $normalizedCandidate = $this->normalizeLookup($candidate);
        if ($normalizedCandidate === '' || in_array($normalizedCandidate, ['null', 'none', 'unknown', 'unassigned'], true)) {
            return null;
        }

        foreach ($items as $item) {
            $itemName = trim((string) ($item['name'] ?? ''));
            if ($itemName !== '' && $this->normalizeLookup($itemName) === $normalizedCandidate) {
                return $item;
            }
        }

        $partialMatches = [];
        foreach ($items as $item) {
            $itemName = trim((string) ($item['name'] ?? ''));
            if ($itemName === '') {
                continue;
            }

            $normalizedItem = $this->normalizeLookup($itemName);
            if (strpos($normalizedItem, $normalizedCandidate) !== false || strpos($normalizedCandidate, $normalizedItem) !== false) {
                $partialMatches[] = $item;
            }
        }

        return count($partialMatches) === 1 ? $partialMatches[0] : null;
    }

    private function normalizeLookup($value)
    {
        $value = mb_strtolower(trim((string) $value), 'UTF-8');
        $value = preg_replace('/[^\p{L}\p{N}]+/u', '', $value);
        return (string) $value;
    }

    private function normalizePriority($priority)
    {
        $priority = strtolower(trim((string) $priority));
        return in_array($priority, ['low', 'medium', 'high', 'urgent'], true) ? $priority : 'medium';
    }

    private function normalizeStatus($status)
    {
        $status = strtolower(trim((string) $status));
        return in_array($status, ['todo', 'in_progress', 'review', 'done'], true) ? $status : 'todo';
    }

    private function normalizeBillStatus($status)
    {
        $status = strtolower(trim((string) $status));
        return in_array($status, ['pending', 'paid', 'overdue'], true) ? $status : 'pending';
    }

    private function normalizeDate($date)
    {
        $date = trim((string) $date);
        if ($date === '') {
            return null;
        }

        $dt = DateTime::createFromFormat('Y-m-d', $date);
        if ($dt && $dt->format('Y-m-d') === $date) {
            return $date;
        }

        return null;
    }

    private function normalizeAmount($amount)
    {
        if ($amount === null || $amount === '') {
            return null;
        }

        $value = trim((string) $amount);
        $value = str_replace([' ', ','], ['', ''], $value);
        if (!is_numeric($value)) {
            return null;
        }

        return round((float) $value, 2);
    }

    private function normalizeColor($color)
    {
        $color = trim((string) $color);
        if ($color === '') {
            return null;
        }

        if (preg_match('/^#?[0-9a-fA-F]{6}$/', $color)) {
            return '#' . ltrim($color, '#');
        }

        return null;
    }

    private function normalizeConfidence($confidence)
    {
        if ($confidence === null || $confidence === '') {
            return null;
        }

        $value = (float) $confidence;
        if ($value < 0) {
            $value = 0;
        }
        if ($value > 1) {
            $value = 1;
        }
        return round($value, 2);
    }
}
