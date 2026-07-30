<?php
class BillController {
    private $storeModel;
    private $billModel;
    private $vendorModel;

    public function __construct() {
        $this->storeModel = new Store();
        $this->billModel = new Bill();
        $this->vendorModel = new Vendor();
    }

    /**
     * GET /bills/templates
     * Recurring bill template manager.
     * Left panel = template list; right panel = create/edit form.
     */
    public function templates() {
        $db         = Database::getInstance();
        $userId     = (int)$_SESSION['user_id'];

        // All recurring templates (is_template=1 OR repeat_parent_id IS NULL AND repeat_type<>'none')
        $hasIsTemplate    = $db->columnExists('bills', 'is_template');
        $hasBizId         = $db->columnExists('bills', 'business_id');
        $hasRepeatParent  = $db->columnExists('bills', 'repeat_parent_id');
        $hasRepeatType    = $db->columnExists('bills', 'repeat_type');

        // BUGFIX RC1-002: Subqueries referencing repeat_parent_id would fail with
        // SQL error if the column didn't exist in the target environment (preview/staging).
        // Added defensive column checks and fallback subqueries.

        $tplWhere  = ($hasIsTemplate && $hasRepeatParent && $hasRepeatType)
            ? "WHERE (b.is_template = 1 OR (b.repeat_parent_id IS NULL AND b.repeat_type <> 'none'))"
            : ($hasRepeatType ? "WHERE b.repeat_type <> 'none'" : "WHERE 1=1");

        $bizSelect = $hasBizId ? 'biz.name AS business_name, biz.color AS business_color,' : "'All' AS business_name, '#6B7280' AS business_color,";
        $bizJoin   = $hasBizId ? "LEFT JOIN businesses biz ON biz.id = b.business_id" : "";

        // Cycle count / date subqueries — guarded by column existence
        $cycleCountSub  = $hasRepeatParent
            ? "(SELECT COUNT(*) FROM bills ch WHERE ch.repeat_parent_id = b.id)"
            : "0";
        $lastGenSub     = $hasRepeatParent
            ? "(SELECT MAX(ch2.due_date) FROM bills ch2 WHERE ch2.repeat_parent_id = b.id)"
            : "NULL";
        $nextDueSub     = $hasRepeatParent
            ? "(SELECT MIN(ch3.due_date) FROM bills ch3 WHERE ch3.repeat_parent_id = b.id AND ch3.due_date >= ?)"
            : "NULL";

        $tplToday = app_today();
        $templates = $db->fetchAll(
            "SELECT b.*,
                    s.name AS store_name, s.color AS store_color,
                    $bizSelect
                    v.name AS vendor_name,
                    COALESCE($cycleCountSub, 0) AS cycle_count,
                    $lastGenSub AS last_generated,
                    $nextDueSub AS next_due
             FROM bills b
             JOIN stores s ON s.id = b.store_id
             $bizJoin
             LEFT JOIN vendors v ON v.id = b.vendor_id
             $tplWhere
             ORDER BY
                CASE WHEN b.status = 'overdue' THEN 0
                     WHEN b.status = 'pending' THEN 1
                     ELSE 2 END,
                b.due_date ASC,
                b.title ASC",
            [$tplToday]
        );

        // Next 3 preview dates for selected template (passed via ?preview={id})
        $previewId       = (int)($_GET['preview'] ?? 0);
        $previewTemplate = null;
        $previewDates    = [];
        if ($previewId) {
            foreach ($templates as $t) {
                if ((int)$t['id'] === $previewId) {
                    $previewTemplate = $t;
                    break;
                }
            }
        }

        $stores          = $this->storeModel->allActive(true);
        $vendors         = $this->vendorModel->getAllActive();
        $businesses      = $db->tableExists('businesses')
            ? $db->fetchAll("SELECT * FROM businesses WHERE is_active=1 ORDER BY sort_order, name")
            : [];

        $billCategories  = ['rent','utility','tax','insurance','payroll','credit_card','waste','licensing','compliance','vendor','software','utilities','electronic','water','phone','trash','subscription','supplies','maintenance','banking','general'];
        $repeatTypes     = ['monthly','weekly','yearly','daily'];

        // Summary stats
        $totalTemplates  = count($templates);
        $activeTemplates = count(array_filter($templates, function($t) { return $t['status'] !== 'archived'; }));
        $totalCycles     = array_sum(array_column($templates, 'cycle_count'));

        $notifications   = new Notification();
        $unreadCount     = $notifications->getUnreadCount($userId);
        $projects        = $this->billModel ? [] : [];

        require __DIR__ . '/../views/bills/templates.php';
    }

    /**
     * POST /bills/templates/create
     * Create a new recurring bill template.
     */
    public function createTemplate() {
        if (!isAdmin() && !isManager()) { redirect('bills/templates'); return; }

        $data = [
            'store_id'         => (int)$_POST['store_id'],
            'title'            => trim($_POST['title'] ?? ''),
            'vendor'           => trim($_POST['vendor'] ?? ''),
            'vendor_id'        => !empty($_POST['vendor_id']) ? (int)$_POST['vendor_id'] : null,
            'amount'           => !empty($_POST['amount']) ? (float)$_POST['amount'] : null,
            'due_date'         => $_POST['due_date'] ?? date('Y-m-d'),
            'status'           => 'pending',
            'category'         => $_POST['category'] ?? 'general',
            'note'             => trim($_POST['note'] ?? ''),
            'repeat_type'      => $_POST['repeat_type'] ?? 'monthly',
            'repeat_interval'  => max(1, (int)($_POST['repeat_interval'] ?? 1)),
            'repeat_anchor'    => !empty($_POST['repeat_day']) ? (int)$_POST['repeat_day'] : null,
        ];

        if (empty($data['title']) || empty($data['store_id'])) {
            flash('error', 'Title and Store are required');
            redirect('bills/templates');
            return;
        }

        // Ensure vendor exists
        if (!empty($data['vendor']) && empty($data['vendor_id'])) {
            $data['vendor_id'] = $this->vendorModel->quickCreate($data['vendor']);
        }

        $newId = $this->billModel->create($data);

        // Mark as template
        if ($newId) {
            $db = Database::getInstance();
            if ($db->columnExists('bills', 'is_template')) {
                $db->execute("UPDATE bills SET is_template=1 WHERE id=?", [$newId]);
            }
        }

        flash('success', 'Recurring template created');
        redirect('bills/templates');
    }

    /**
     * POST /bills/templates/{id}/generate
     * Manually trigger recurring generation for current month for a template.
     */
    public function generateTemplate($templateId) {
        if (!isAdmin() && !isManager()) { redirect('bills/templates'); return; }

        $template = $this->billModel->find($templateId);
        if (!$template) { flash('error', 'Template not found'); redirect('bills/templates'); return; }

        $month   = (int)($_POST['month'] ?? date('m'));
        $year    = (int)($_POST['year']  ?? date('Y'));
        $created = $this->billModel->ensureRecurringForMonth($template['store_id'], $month, $year);

        flash('success', "{$created} bill cycle(s) generated for " . date('F Y', mktime(0,0,0,$month,1,$year)));
        redirect('bills/templates?tpl=' . (int)$templateId);
    }

    public function index() {
        $this->vendorModel->syncFromBills();
        $db = Database::getInstance();

        // Month / year navigation params
        $month = max(1, min(12, (int)(isset($_GET['month']) ? $_GET['month'] : date('m'))));
        $year  = max(2020, min(2040, (int)(isset($_GET['year'])  ? $_GET['year']  : date('Y'))));

        $prevMonth = $month - 1; $prevYear = $year;
        if ($prevMonth < 1) { $prevMonth = 12; $prevYear--; }
        $nextMonth = $month + 1; $nextYear = $year;
        if ($nextMonth > 12) { $nextMonth = 1; $nextYear++; }

        // Filter params (server-side)
        $filterStore    = (int)(isset($_GET['store_id'])    ? $_GET['store_id']    : 0);
        $filterCategory = trim(isset($_GET['category'])    ? $_GET['category']    : '');
        $filterStatus   = trim(isset($_GET['status'])      ? $_GET['status']      : '');
        $filterVendorId = (int)(isset($_GET['vendor_id'])  ? $_GET['vendor_id']   : 0);
        $hasFinanceCategory = $db->columnExists('bills', 'finance_category');
        $hasBillCategoryLinks = $db->tableExists('bill_category_links');
        $categoryExpr = $hasFinanceCategory
            ? "COALESCE(NULLIF(b.category, ''), NULLIF(b.finance_category, ''), 'general')"
            : "COALESCE(NULLIF(b.category, ''), 'general')";

        // All active stores for filter dropdown + sidebar
        $allStores = $this->storeModel->allActive();

        // Ensure recurring for all relevant stores
        $storesToSync = $filterStore ? [['id' => $filterStore]] : $allStores;
        foreach ($storesToSync as $s) {
            $this->billModel->ensureRecurringForMonth($s['id'], $month, $year);
        }

        // Build WHERE for cross-store query
        $where  = ["MONTH(b.due_date) = ?", "YEAR(b.due_date) = ?"];
        $params = [$month, $year];
        if ($filterStore)    { $where[] = "b.store_id = ?";   $params[] = $filterStore; }
        if ($filterCategory) {
            if ($hasBillCategoryLinks) {
                $where[] = "($categoryExpr = ? OR EXISTS (SELECT 1 FROM bill_category_links bcl WHERE bcl.bill_id = b.id AND bcl.category = ?))";
                $params[] = $filterCategory;
                $params[] = $filterCategory;
            } else {
                $where[] = "$categoryExpr = ?";
                $params[] = $filterCategory;
            }
        }
        if ($filterStatus)   { $where[] = "b.status = ?";     $params[] = $filterStatus; }
        if ($filterVendorId) { $where[] = "b.vendor_id = ?";  $params[] = $filterVendorId; }
        $whereSQL = "WHERE " . implode(" AND ", $where);

        $allBills = $db->fetchAll(
            "SELECT b.*, s.name as store_name, s.color as store_color,
                    $categoryExpr as display_category,
                    COALESCE(v.name, b.vendor) as vendor_label
             FROM bills b
             LEFT JOIN stores s ON b.store_id = s.id
             LEFT JOIN vendors v ON b.vendor_id = v.id
             $whereSQL
             ORDER BY b.due_date ASC, b.due_time ASC, b.id ASC",
            $params
        );
        foreach ($allBills as &$b) {
            $b['categories'] = $this->billModel->getCategories((int)$b['id']);
            if (!empty($b['categories'])) {
                $b['display_category'] = $b['categories'][0];
                $b['category'] = $b['categories'][0];
            }
        }
        unset($b);

        // Group by date
        $billsByDate = [];
        foreach ($allBills as $b) {
            $dateKey = substr($b['due_date'], 0, 10);
            $billsByDate[$dateKey][] = $b;
        }

        // Summary stats
        $today   = app_today();
        $weekEnd = date('Y-m-d', strtotime(app_today() . ' +7 days'));
        $summary = [
            'total_bills'    => count($allBills),
            'paid_count'     => 0,
            'overdue_count'  => 0,
            'due_week_count' => 0,
            'pending_count'  => 0,
            'total_amount'   => 0.0,
            'unpaid_amount'  => 0.0,
        ];
        foreach ($allBills as $b) {
            $summary['total_amount'] += (float)($b['amount'] ?? 0);
            if ($b['status'] === 'paid') {
                $summary['paid_count']++;
            } else {
                $summary['unpaid_amount'] += (float)($b['amount'] ?? 0);
                $d = $b['due_date'] ? substr($b['due_date'], 0, 10) : '';
                if ($d && $d < $today) {
                    $summary['overdue_count']++;
                } elseif ($d && $d >= $today && $d <= $weekEnd) {
                    $summary['due_week_count']++;
                } else {
                    $summary['pending_count']++;
                }
            }
        }

        // Upcoming bills — next 7 days, any store
        $upcomingWhere = "WHERE b.due_date >= ? AND b.due_date <= ? AND b.status != 'paid'";
        $upcomingParams = [$today, $weekEnd];
        if ($filterStore) { $upcomingWhere .= " AND b.store_id = ?"; $upcomingParams[] = $filterStore; }
        $upcomingBills = $db->fetchAll(
            "SELECT b.*, s.name as store_name, s.color as store_color,
                    $categoryExpr as display_category,
                    COALESCE(v.name, b.vendor) as vendor_label
             FROM bills b
             LEFT JOIN stores s ON b.store_id = s.id
             LEFT JOIN vendors v ON b.vendor_id = v.id
             $upcomingWhere
             ORDER BY b.due_date ASC, b.due_time ASC
             LIMIT 20",
            $upcomingParams
        );
        foreach ($upcomingBills as &$b) {
            $b['categories'] = $this->billModel->getCategories((int)$b['id']);
            if (!empty($b['categories'])) {
                $b['display_category'] = $b['categories'][0];
                $b['category'] = $b['categories'][0];
            }
        }
        unset($b);

        // Store breakdown (for sidebar)
        $storeStats = [];
        foreach ($allBills as $b) {
            $sid = (int)$b['store_id'];
            if (!isset($storeStats[$sid])) {
                $storeStats[$sid] = [
                    'id'      => $sid,
                    'name'    => $b['store_name'],
                    'color'   => $b['store_color'],
                    'total'   => 0,
                    'paid'    => 0,
                    'overdue' => 0,
                ];
            }
            $storeStats[$sid]['total']++;
            if ($b['status'] === 'paid') {
                $storeStats[$sid]['paid']++;
            } elseif ($b['due_date'] && substr($b['due_date'], 0, 10) < $today) {
                $storeStats[$sid]['overdue']++;
            }
        }
        uasort($storeStats, function($a, $b) { return $b['overdue'] - $a['overdue']; });

        // Vendors and categories for filters
        $allVendors = $this->vendorModel->getAllActive();
        $categories = ['rent','utility','tax','insurance','payroll','credit_card','waste','licensing','compliance','vendor','software','utilities','electronic','water','phone','trash','subscription','supplies','maintenance','banking','general'];

        // Legacy store list/count for the "Add Store" card
        $stores       = $allStores;
        $billCounts   = $this->billModel->countByStore();
        $billCountMap = [];
        foreach ($billCounts as $bc) { $billCountMap[$bc['store_id']] = $bc; }

        $monthNames = ['', 'January','February','March','April','May','June',
                       'July','August','September','October','November','December'];

        $unreadCount = (new Notification())->getUnreadCount($_SESSION['user_id']);
        $projects    = (new Project())->getByUser($_SESSION['user_id'], true);

        require __DIR__ . '/../views/bills/index.php';
    }

    /**
     * GET /bills/{id}
     * Compact detail page used by the shared detail drawer and deep links.
     */
    public function show($id) {
        if (!isLoggedIn()) { redirect('login'); return; }

        $bill = $this->billModel->find($id);
        if (!$bill) {
            flash('error', 'Bill not found');
            redirect('bills');
            return;
        }

        $today = app_today();
        $dueDate = !empty($bill['due_date']) ? substr($bill['due_date'], 0, 10) : null;
        $isOverdue = $dueDate && $dueDate < $today && ($bill['status'] ?? '') !== 'paid';
        $billCategories = $this->billModel->getCategories((int)$id);
        if (empty($billCategories) && !empty($bill['category'])) {
            $billCategories = [(string)$bill['category']];
        }
        $categoryOptions = $this->billModel->allowedCategories();
        $vendors = $this->vendorModel->getAllActive();
        $users = (new User())->getActive();
        $linkedTasks = $this->billModel->getLinkedTasks((int)$id);
        $canEditBillDetail = canAdmin();
        $currentPage = 'bills';

        require __DIR__ . '/../views/bills/show.php';
    }

    /**
     * JSON API: GET /api/bills/{id}/detail
     * Returns bill data for the calendar modal.
     */
    public function apiDetail($id) {
        if (!isLoggedIn()) { json_response(['error' => 'Unauthorized'], 401); return; }
        $bill = $this->billModel->find($id);
        if (!$bill) { json_response(['error' => 'Not found'], 404); return; }
        $today = app_today();
        $due   = $bill['due_date'] ? substr($bill['due_date'], 0, 10) : null;
        $category = $bill['category'] ?? null;
        if (($category === null || $category === '') && array_key_exists('finance_category', $bill)) {
            $category = $bill['finance_category'];
        }
        $categories = $this->billModel->getCategories((int)$id);
        if (empty($categories) && $category) {
            $categories = [$category];
        }
        json_response([
            'bill' => [
                'id'           => (int)$bill['id'],
                'title'        => $bill['title'],
                'vendor_label' => $bill['vendor_name'] ?? $bill['vendor'] ?? null,
                'store_id'     => (int)$bill['store_id'],
                'store_name'   => $bill['store_name'] ?? null,
                'store_color'  => $bill['store_color'] ?? null,
                'due_date'     => $due,
                'due_month'    => $due ? (int)date('m', strtotime($due)) : null,
                'due_year'     => $due ? (int)date('Y', strtotime($due)) : null,
                'amount'       => (float)($bill['amount'] ?? 0),
                'status'       => $bill['status'],
                'is_overdue'   => $due && $due < $today && $bill['status'] !== 'paid',
                'repeat_type'  => $bill['repeat_type'] ?? 'none',
                'category'     => $category,
                'categories'   => $categories,
                'note'         => $bill['note'] ?? null,
            ]
        ]);
    }

    public function storeView($storeId) {
        $this->vendorModel->syncFromBills();
        $store = $this->storeModel->find($storeId);
        if (!$store) { flash('error','Store not found'); redirect('bills'); }

        // Month/year navigation
        $month = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('m');
        $year  = isset($_GET['year']) ? (int)$_GET['year']  : (int)date('Y');

        if ($month < 1) { $month = 12; $year--; }
        if ($month > 12) { $month = 1; $year++; }

        $prevMonth = $month - 1; $prevYear = $year;
        if ($prevMonth < 1) { $prevMonth = 12; $prevYear--; }
        $nextMonth = $month + 1; $nextYear = $year;
        if ($nextMonth > 12) { $nextMonth = 1; $nextYear++; }

        $this->billModel->ensureRecurringForMonth($storeId, $month, $year);
        $bills = $this->billModel->getByStore($storeId, $month, $year);

        // Load attachments for each bill
        foreach ($bills as &$b) {
            $b['attachments'] = $this->billModel->getAttachments($b['id']);
            $b['categories'] = $this->billModel->getCategories((int)$b['id']);
            if (!empty($b['categories'])) {
                $b['category'] = $b['categories'][0];
            }
        }
        unset($b);

        // Group by date
        $billsByDate = [];
        foreach ($bills as $b) {
            $billsByDate[$b['due_date']][] = $b;
        }

        // Monthly summary stats
        $summary = $this->billModel->monthlySummary($storeId, $month, $year);

        // Vendors for dropdown
        $vendors = $this->vendorModel->getAllActive();
        $users = (new User())->getActive();
        $categoryOptions = $this->billModel->allowedCategories();

        require __DIR__ . '/../views/bills/store.php';
    }

    public function createStore() {
        if (!verify_csrf($_POST['csrf'] ?? '')) { flash('error','Invalid CSRF'); redirect('bills'); }
        $name = trim($_POST['name'] ?? '');
        if ($name === '') { flash('error','Store name is required'); redirect('bills'); }
        $this->storeModel->create([
            'name' => $name,
            'address' => trim($_POST['address'] ?? ''),
            'color' => trim($_POST['color'] ?? '')
        ]);
        flash('success','Store created');
        redirect('bills');
    }

    public function updateStore($storeId) {
        if (!verify_csrf($_POST['csrf'] ?? '')) { flash('error','Invalid CSRF'); redirect('bills'); }
        $store = $this->storeModel->find($storeId);
        if (!$store) { flash('error','Store not found'); redirect('bills'); }
        $name = trim($_POST['name'] ?? '');
        if ($name === '') { flash('error','Store name is required'); redirect('bills'); }
        $this->storeModel->update($storeId, [
            'name' => $name,
            'address' => trim($_POST['address'] ?? ''),
            'color' => trim($_POST['color'] ?? '')
        ]);
        flash('success','Store updated');
        redirect('bills');
    }

    public function deleteStore($storeId) {
        $store = $this->storeModel->find($storeId);
        if (!$store) { flash('error','Store not found'); redirect('bills'); }
        $this->storeModel->delete($storeId);
        flash('success','Store deleted');
        redirect('bills');
    }

    public function createBill() {
        if (!verify_csrf($_POST['csrf'] ?? '')) { flash('error','Invalid CSRF'); redirect('bills'); }
        $storeId = (int)($_POST['store_id'] ?? 0);
        $title = trim($_POST['title'] ?? '');
        $due = $_POST['due_date'] ?? '';
        if (!$storeId || $title === '' || $due === '') { flash('error','Missing required fields'); redirect('bills'); }

        // Handle vendor: either vendor_id or new vendor name
        $vendorId = null;
        $vendorName = '';
        $vendorSelect = $_POST['vendor_id'] ?? '';
        if ($vendorSelect === 'new') {
            $newVendorName = trim($_POST['vendor_new'] ?? '');
            if ($newVendorName !== '') {
                $vendorId = $this->vendorModel->quickCreate($newVendorName);
                $vendorName = $newVendorName;
            }
        } elseif ($vendorSelect !== '') {
            $vendorId = (int)$vendorSelect;
            $v = $this->vendorModel->find($vendorId);
            $vendorName = $v ? $v['name'] : '';
        }

        $repeat = $this->extractRepeatSettings($_POST, $due);
        $billCategories = $this->parseBillCategoriesFromPost();

        $db = Database::getInstance();

        $createData = [
            'store_id'           => $storeId,
            'title'              => $title,
            'vendor'             => $vendorName,
            'vendor_id'          => $vendorId,
            'amount'             => $_POST['amount'] ?? null,
            'due_date'           => $due,
            'note'               => trim($_POST['note'] ?? ''),
            'color'              => trim($_POST['color'] ?? ''),
            'repeat_type'        => $repeat['repeat_type'],
            'repeat_interval'    => $repeat['repeat_interval'],
            'repeat_anchor'      => $repeat['repeat_anchor'],
            'category'           => $billCategories[0] ?? 'general',
            'categories'         => $billCategories,
        ];

        // New fields — only add if columns exist
        if ($db->columnExists('bills', 'responsible_user_id')) {
            $createData['responsible_user_id'] = !empty($_POST['responsible_user_id']) ? (int)$_POST['responsible_user_id'] : null;
        }
        if ($db->columnExists('bills', 'checker_user_id')) {
            $createData['checker_user_id'] = !empty($_POST['checker_user_id']) ? (int)$_POST['checker_user_id'] : null;
        }
        if ($db->columnExists('bills', 'approver_user_id')) {
            $createData['approver_user_id'] = !empty($_POST['approver_user_id']) ? (int)$_POST['approver_user_id'] : null;
        }
        if ($db->columnExists('bills', 'verifier_user_id')) {
            $createData['verifier_user_id'] = !empty($_POST['verifier_user_id']) ? (int)$_POST['verifier_user_id'] : null;
        }
        if ($db->columnExists('bills', 'reviewer_id')) {
            $createData['reviewer_id'] = !empty($_POST['reviewer_id']) ? (int)$_POST['reviewer_id'] : null;
            $createData['review_status'] = !empty($_POST['reviewer_id']) ? 'pending_review' : 'not_required';
        }
        if ($db->columnExists('bills', 'reviewer_due_date')) {
            $createData['reviewer_due_date'] = !empty($_POST['reviewer_due_date']) ? $_POST['reviewer_due_date'] : null;
        }
        if ($db->columnExists('bills', 'review_instructions')) {
            $createData['review_instructions'] = trim($_POST['review_instructions'] ?? '');
        }
        if ($db->columnExists('bills', 'payment_method')) {
            $allowedPM = ['bank_transfer','check','credit_card','ach','wire','wells_fargo','other'];
            $pm = $_POST['payment_method'] ?? '';
            $createData['payment_method'] = in_array($pm, $allowedPM, true) ? $pm : null;
        }
        if ($db->columnExists('bills', 'frequency')) {
            $allowedFreq = ['once','weekly','biweekly','monthly','quarterly','annual'];
            $freq = $_POST['frequency'] ?? 'monthly';
            $createData['frequency'] = in_array($freq, $allowedFreq, true) ? $freq : 'monthly';
        }
        if ($db->columnExists('bills', 'notes')) {
            $createData['notes'] = trim($_POST['notes'] ?? $_POST['note'] ?? '');
        }

        $billId = $this->billModel->create($createData);

        // Compute and save duplicate hash
        if ($billId && method_exists($this->billModel, 'computeAndSaveHash')) {
            $this->billModel->computeAndSaveHash($billId);
        }

        // Handle file upload if present
        if (!empty($_FILES['bill_file']) && $_FILES['bill_file']['error'] === UPLOAD_ERR_OK) {
            $this->handleBillFileUpload($billId, $_FILES['bill_file']);
        }

        flash('success','Bill added');
        redirect('bills/store/'.$storeId.'?month='.date('m',strtotime($due)).'&year='.date('Y',strtotime($due)));
    }

    public function updateBill($billId) {
        if (!verify_csrf($_POST['csrf'] ?? '')) { flash('error','Invalid CSRF'); redirect('bills'); }
        $bill = $this->billModel->find($billId);
        if (!$bill) { flash('error','Bill not found'); redirect('bills'); }

        $title = trim($_POST['title'] ?? '');
        $due = $_POST['due_date'] ?? '';
        if ($title === '' || $due === '') { flash('error','Missing required fields'); redirect('bills/store/'.$bill['store_id']); }

        // Handle vendor
        $vendorId = null;
        $vendorName = '';
        $vendorSelect = $_POST['vendor_id'] ?? '';
        if ($vendorSelect === 'new') {
            $newVendorName = trim($_POST['vendor_new'] ?? '');
            if ($newVendorName !== '') {
                $vendorId = $this->vendorModel->quickCreate($newVendorName);
                $vendorName = $newVendorName;
            }
        } elseif ($vendorSelect !== '') {
            $vendorId = (int)$vendorSelect;
            $v = $this->vendorModel->find($vendorId);
            $vendorName = $v ? $v['name'] : '';
        }

        // Handle status - allow user to change status
        $status = $_POST['status'] ?? $bill['status'];
        $allowedStatuses = ['pending', 'paid', 'overdue'];
        if (!in_array($status, $allowedStatuses)) $status = 'pending';

        // Auto-reset to pending if due_date changed to future and was overdue
        if ($bill['status'] === 'overdue' && $status === 'overdue' && strtotime($due) >= strtotime(app_today())) {
            $status = 'pending';
        }

        $repeat = $this->extractRepeatSettings($_POST, $due);
        $billCategories = $this->parseBillCategoriesFromPost();

        $db = Database::getInstance();
        $updateData = [
            'title' => $title,
            'vendor' => $vendorName,
            'vendor_id' => $vendorId,
            'amount' => $_POST['amount'] ?? null,
            'due_date' => $due,
            'status' => $status,
            'note' => trim($_POST['note'] ?? ''),
            'color' => trim($_POST['color'] ?? ''),
            'repeat_type' => $repeat['repeat_type'],
            'repeat_interval' => $repeat['repeat_interval'],
            'repeat_anchor' => $repeat['repeat_anchor'],
            'repeat_parent_id' => $bill['repeat_parent_id'] ?? null,
            'category' => $billCategories[0] ?? null,
            'categories' => $billCategories,
        ];

        if ($db->columnExists('bills', 'responsible_user_id')) {
            $updateData['responsible_user_id'] = !empty($_POST['responsible_user_id']) ? (int)$_POST['responsible_user_id'] : null;
        }
        if ($db->columnExists('bills', 'checker_user_id')) {
            $updateData['checker_user_id'] = !empty($_POST['checker_user_id']) ? (int)$_POST['checker_user_id'] : null;
        }
        if ($db->columnExists('bills', 'approver_user_id')) {
            $updateData['approver_user_id'] = !empty($_POST['approver_user_id']) ? (int)$_POST['approver_user_id'] : null;
        }
        if ($db->columnExists('bills', 'verifier_user_id')) {
            $updateData['verifier_user_id'] = !empty($_POST['verifier_user_id']) ? (int)$_POST['verifier_user_id'] : null;
        }
        if ($db->columnExists('bills', 'reviewer_id')) {
            $updateData['reviewer_id'] = !empty($_POST['reviewer_id']) ? (int)$_POST['reviewer_id'] : null;
            $oldReviewStatus = $bill['review_status'] ?? 'not_required';
            $updateData['review_status'] = !empty($_POST['reviewer_id'])
                ? ($oldReviewStatus === 'not_required' ? 'pending_review' : $oldReviewStatus)
                : 'not_required';
        }
        if ($db->columnExists('bills', 'reviewer_due_date')) {
            $updateData['reviewer_due_date'] = !empty($_POST['reviewer_due_date']) ? $_POST['reviewer_due_date'] : null;
        }
        if ($db->columnExists('bills', 'review_instructions')) {
            $updateData['review_instructions'] = trim($_POST['review_instructions'] ?? '');
        }
        if ($db->columnExists('bills', 'payment_method')) {
            $allowedPM = ['bank_transfer','check','credit_card','ach','wire','wells_fargo','other'];
            $pm = $_POST['payment_method'] ?? '';
            $updateData['payment_method'] = in_array($pm, $allowedPM, true) ? $pm : null;
        }
        if ($db->columnExists('bills', 'frequency')) {
            $allowedFreq = ['once','weekly','biweekly','monthly','quarterly','annual'];
            $freq = $_POST['frequency'] ?? '';
            $updateData['frequency'] = in_array($freq, $allowedFreq, true) ? $freq : null;
        }
        if ($db->columnExists('bills', 'notes')) {
            $updateData['notes'] = trim($_POST['notes'] ?? $_POST['note'] ?? '');
        }

        $this->billModel->update($billId, $updateData);

        $repeatSourceId = !empty($bill['repeat_parent_id']) ? (int)$bill['repeat_parent_id'] : (int)$billId;
        $this->billModel->updateRepeatSettings($repeatSourceId, $repeat);

        // If status changed to paid, track paid_at
        if ($status === 'paid' && $bill['status'] !== 'paid') {
            $this->billModel->markPaid($billId);
        }
        // If status changed from paid back to pending, clear paid_at
        if ($status !== 'paid' && $bill['status'] === 'paid') {
            $this->billModel->markPending($billId);
        }

        // Handle file upload if present
        if (!empty($_FILES['bill_file']) && $_FILES['bill_file']['error'] === UPLOAD_ERR_OK) {
            $this->handleBillFileUpload($billId, $_FILES['bill_file']);
        }

        flash('success','Bill updated');
        redirect('bills/store/'.$bill['store_id'].'?month='.date('m',strtotime($due)).'&year='.date('Y',strtotime($due)));
    }

    public function createTaskFromBill($billId) {
        if (!isLoggedIn() || !canAdmin()) { redirect('bills'); return; }
        if (!verify_csrf($_POST['csrf'] ?? '')) { flash('error','Invalid CSRF'); redirect('bills/' . (int)$billId); return; }

        $bill = $this->billModel->find($billId);
        if (!$bill) { flash('error','Bill not found'); redirect('bills'); return; }

        $db = Database::getInstance();
        $existing = $this->billModel->getLinkedTasks((int)$billId);
        if (!empty($existing)) {
            redirect('tasks/' . (int)$existing[0]['id']);
            return;
        }

        $project = $db->fetch("SELECT id FROM projects WHERE name = 'Finance' ORDER BY id LIMIT 1");
        $projectId = $project ? (int)$project['id'] : 0;
        if (!$projectId) {
            $projectId = (int)(new Project())->create([
                'name' => 'Finance',
                'description' => 'Finance operations and recurring obligations',
                'color' => '#2563eb',
                'owner_id' => (int)($_SESSION['user_id'] ?? 1),
                'status' => 'active',
                'store_id' => $bill['store_id'] ?? null,
            ]);
        }
        $sectionId = (new Section())->getDefaultForProject($projectId);
        $categories = $this->billModel->getCategories((int)$billId);
        if (empty($categories)) {
            $categories = ['bill'];
        }

        $task = new Task();
        $taskId = (int)$task->create([
            'project_id' => $projectId,
            'section_id' => $sectionId,
            'title' => $bill['title'],
            'description' => trim("Bill task created from bill #" . (int)$billId . "\n\n" . ($bill['note'] ?? '')),
            'notes' => $bill['notes'] ?? $bill['note'] ?? null,
            'assignee_id' => $bill['responsible_user_id'] ?? $_SESSION['user_id'],
            'priority' => (($bill['status'] ?? '') === 'overdue') ? 'high' : 'medium',
            'status' => 'todo',
            'visibility' => 'private',
            'private_by_user_id' => $_SESSION['user_id'] ?? null,
            'due_date' => $bill['due_date'] ?? null,
            'start_date' => null,
            'created_by' => $_SESSION['user_id'] ?? null,
            'task_category' => $categories[0] ?? 'bill',
            'direct_store_id' => $bill['store_id'] ?? null,
            'bill_id' => (int)$billId,
        ]);
        if ($taskId) {
            $task->syncCategories($taskId, $categories);
            $task->linkToBill($taskId, (int)$billId);
            $task->setDirectStore($taskId, (int)$bill['store_id']);
            flash('success', 'Task created from bill');
            redirect('tasks/' . $taskId);
            return;
        }

        flash('error', 'Could not create task from bill');
        redirect('bills/' . (int)$billId);
    }

    public function deleteBill($billId) {
        $bill = $this->billModel->find($billId);
        if (!$bill) { flash('error','Bill not found'); redirect('bills'); }
        $this->billModel->delete($billId);
        flash('success','Bill deleted');
        redirect('bills/store/'.$bill['store_id']);
    }

    public function markPaid($billId) {
        $bill = $this->billModel->find($billId);
        if (!$bill) { flash('error','Bill not found'); redirect('bills'); }
        $this->billModel->markPaid($billId);
        flash('success','Marked as paid');
        $referer = $_SERVER['HTTP_REFERER'] ?? APP_URL . '/bills/store/' . $bill['store_id'];
        header("Location: $referer");
        exit;
    }

    /**
     * POST /api/bills/{id}/pay — AJAX pay without reload.
     * Returns JSON with updated section summary for instant UI update.
     */
    public function apiMarkPaid($billId) {
        if (!isLoggedIn()) { json_response(['error'=>'Unauthorized'], 401); return; }
        $bill = $this->billModel->find($billId);
        if (!$bill) { json_response(['error'=>'Not found'], 404); return; }
        if ($bill['status'] === 'paid') { json_response(['ok'=>true,'already_paid'=>true]); return; }

        $paymentMethod = $bill['payment_method'] ?? 'bank_transfer';
        if ($paymentMethod === 'credit_card') $paymentMethod = 'card';
        if ($paymentMethod === 'wells_fargo') $paymentMethod = 'bank_transfer';

        (new Payment())->create([
            'bill_id' => (int)$billId,
            'amount' => (float)($bill['amount'] ?? 0),
            'paid_at' => date('Y-m-d H:i:s'),
            'method' => $paymentMethod,
            'reviewer_id' => $bill['reviewer_id'] ?? null,
            'reviewer_due_date' => $bill['reviewer_due_date'] ?? null,
            'review_instructions' => $bill['review_instructions'] ?? null,
            'verifier_user_id' => $bill['verifier_user_id'] ?? null,
            'created_by' => (int)($_SESSION['user_id'] ?? 0),
        ]);
        $this->billModel->markPaid($billId);

        // Return updated counts for the current month so schedule view can update instantly
        $db    = Database::getInstance();
        $today = app_today();
        $month = (int)date('m'); $year = (int)date('Y');
        $summary = $db->fetch(
            "SELECT
                SUM(status='paid') AS paid_count,
                SUM(status IN ('overdue','pending') AND due_date < ?) AS overdue_count,
                SUM(status IN ('pending','overdue')) AS unpaid_count,
                COALESCE(SUM(CASE WHEN status IN ('pending','overdue') THEN amount ELSE 0 END),0) AS unpaid_amount
             FROM bills WHERE MONTH(due_date)=? AND YEAR(due_date)=?",
            [$today, $month, $year]
        );

        json_response([
            'ok'       => true,
            'bill_id'  => (int)$billId,
            'title'    => $bill['title'],
            'summary'  => $summary,
        ]);
    }

    public function duplicateBill($billId) {
        $bill = $this->billModel->find($billId);
        if (!$bill) { flash('error','Bill not found'); redirect('bills'); }

        // Duplicate to next month, same day
        $dueDate = $bill['due_date'];
        $nextMonth = date('Y-m-d', strtotime($dueDate . ' +1 month'));

        $newId = $this->billModel->duplicate($billId, $nextMonth);
        if ($newId) {
            flash('success', 'Bill duplicated to ' . date('d/m/Y', strtotime($nextMonth)));
            redirect('bills/store/'.$bill['store_id'].'?month='.date('m',strtotime($nextMonth)).'&year='.date('Y',strtotime($nextMonth)));
        } else {
            flash('error', 'Failed to duplicate bill');
            redirect('bills/store/'.$bill['store_id']);
        }
    }

    public function uploadBillFile($billId) {
        $bill = $this->billModel->find($billId);
        if (!$bill) json_response(['error' => 'Bill not found'], 404);

        if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            json_response(['error' => 'Upload failed'], 400);
        }

        $file = $_FILES['file'];
        if ($file['size'] > MAX_UPLOAD_SIZE) {
            json_response(['error' => 'File too large (max 10MB)'], 400);
        }

        if (!is_dir(UPLOAD_DIR)) mkdir(UPLOAD_DIR, 0755, true);

        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = uniqid() . '_' . time() . '.' . $ext;

        if (move_uploaded_file($file['tmp_name'], UPLOAD_DIR . $filename)) {
            $attId = $this->billModel->addAttachment([
                'bill_id' => $billId,
                'filename' => $filename,
                'original_name' => $file['name'],
                'file_size' => $file['size'],
                'mime_type' => $file['type'],
            ]);
            json_response(['success' => true, 'id' => $attId, 'filename' => $file['name']]);
        }
        json_response(['error' => 'Upload failed'], 500);
    }

    public function deleteBillAttachment($attId) {
        $att = $this->billModel->deleteAttachment($attId);
        if (!$att) { flash('error', 'Attachment not found'); redirect('bills'); }
        flash('success', 'Attachment deleted');
        // Redirect back
        $referer = $_SERVER['HTTP_REFERER'] ?? APP_URL . '/bills';
        header("Location: $referer");
        exit;
    }

    public function downloadBillAttachment($attId) {
        $att = $this->billModel->findAttachment($attId);
        if (!$att) { http_response_code(404); echo 'Not found'; exit; }

        $filepath = UPLOAD_DIR . $att['filename'];
        if (!file_exists($filepath)) { http_response_code(404); echo 'File not found'; exit; }

        header('Content-Type: ' . ($att['mime_type'] ?: 'application/octet-stream'));
        header('Content-Disposition: attachment; filename="' . $att['original_name'] . '"');
        header('Content-Length: ' . filesize($filepath));
        readfile($filepath);
        exit;
    }

    private function handleBillFileUpload($billId, $file) {
        if ($file['size'] > MAX_UPLOAD_SIZE) return;
        if (!is_dir(UPLOAD_DIR)) mkdir(UPLOAD_DIR, 0755, true);

        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = uniqid() . '_' . time() . '.' . $ext;

        if (move_uploaded_file($file['tmp_name'], UPLOAD_DIR . $filename)) {
            $this->billModel->addAttachment([
                'bill_id' => $billId,
                'filename' => $filename,
                'original_name' => $file['name'],
                'file_size' => $file['size'],
                'mime_type' => $file['type'],
            ]);
        }
    }

    /**
     * Admin-only: detect finance-pattern projects (tax, utilities, insurance, etc.)
     * and convert them to recurring bills. Archives the source project after conversion.
     *
     * POST /admin/bills/convert-projects
     * Optional: project_ids[] to convert specific ones; omit to convert all detected.
     */
    public function convertProjectsToBills() {
        if (!isAdmin()) { flash('error', 'Unauthorized'); redirect('bills'); return; }

        $db = Database::getInstance();

        // Finance project detection rules: keyword → bill metadata
        $rules = [
            'pge'          => ['vendor' => 'PG&E',       'category' => 'utilities', 'due_day' => 20],
            'pg&e'         => ['vendor' => 'PG&E',       'category' => 'utilities', 'due_day' => 20],
            'qb tax'       => ['vendor' => 'QuickBooks', 'category' => 'tax',       'due_day' => 20],
            'quickbooks'   => ['vendor' => 'QuickBooks', 'category' => 'tax',       'due_day' => 20],
            'sale tax'     => ['vendor' => 'CA CDTFA',   'category' => 'tax',       'due_day' => 20],
            'sales tax'    => ['vendor' => 'CA CDTFA',   'category' => 'tax',       'due_day' => 20],
            'prepayment'   => ['vendor' => null,         'category' => 'rent',      'due_day' => 1],
            'amtrust'      => ['vendor' => 'Amtrust',    'category' => 'insurance', 'due_day' => 23],
            'insurance'    => ['vendor' => null,         'category' => 'insurance', 'due_day' => null],
            'payroll'      => ['vendor' => null,         'category' => 'payroll',   'due_day' => null],
            'salary'       => ['vendor' => null,         'category' => 'payroll',   'due_day' => null],
            'rent'         => ['vendor' => null,         'category' => 'rent',      'due_day' => 1],
            'lease'        => ['vendor' => null,         'category' => 'rent',      'due_day' => 1],
            'general'      => ['vendor' => null,         'category' => 'general',   'due_day' => 1],
        ];

        // Specific project IDs requested, or all active projects without store tasks
        $requestedIds = array_filter(array_map('intval', $_POST['project_ids'] ?? []));

        if (!empty($requestedIds)) {
            $placeholders = implode(',', array_fill(0, count($requestedIds), '?'));
            $projects = $db->fetchAll(
                "SELECT p.*, s.id as sid, s.name as store_name
                 FROM projects p LEFT JOIN stores s ON p.store_id = s.id
                 WHERE p.id IN ({$placeholders}) AND (p.status = 'active' OR p.status IS NULL)",
                $requestedIds
            );
        } else {
            // Auto-detect: projects whose names match any finance rule
            $projects = $db->fetchAll(
                "SELECT p.*, s.id as sid, s.name as store_name
                 FROM projects p LEFT JOIN stores s ON p.store_id = s.id
                 WHERE (p.status = 'active' OR p.status IS NULL)"
            );
            // Filter to only finance-pattern names
            $projects = array_filter($projects, function($p) use ($rules) {
                $nameLower = strtolower($p['name']);
                foreach ($rules as $keyword => $_) {
                    if (strpos($nameLower, $keyword) !== false) return true;
                }
                return false;
            });
        }

        $converted = 0;
        $skipped   = 0;
        $userId    = (int)$_SESSION['user_id'];

        foreach ($projects as $proj) {
            $nameLower = strtolower($proj['name']);
            $storeId   = $proj['store_id'] ? (int)$proj['store_id'] : null;

            if (!$storeId) { $skipped++; continue; } // must have a store

            // Find the best matching rule (longest keyword wins)
            $matched = null;
            $matchLen = 0;
            foreach ($rules as $keyword => $meta) {
                if (strpos($nameLower, $keyword) !== false && strlen($keyword) > $matchLen) {
                    $matched  = $meta;
                    $matchLen = strlen($keyword);
                }
            }
            if (!$matched) { $skipped++; continue; }

            // Compute next due date
            $dueDay  = $matched['due_day'] ?? (int)date('j');
            $today   = (int)date('j');
            $month   = (int)date('m');
            $year    = (int)date('Y');
            if ($today < $dueDay) {
                $maxDay = (int)date('t');
                $safeDueDay = min($dueDay, $maxDay);
            } else {
                $month++;
                if ($month > 12) { $month = 1; $year++; }
                $safeDueDay = min($dueDay, (int)date('t', mktime(0, 0, 0, $month, 1, $year)));
            }
            $nextDue = sprintf('%04d-%02d-%02d', $year, $month, $safeDueDay);

            // Skip if a recurring bill with same title+store already exists
            $exists = $db->fetch(
                "SELECT id FROM bills WHERE store_id = ? AND title = ? AND repeat_type = 'monthly' LIMIT 1",
                [$storeId, $proj['name']]
            );
            if ($exists) {
                // Archive the project (bill already exists)
                $db->execute("UPDATE projects SET status = 'archived' WHERE id = ?", [$proj['id']]);
                $converted++;
                continue;
            }

            // Create the recurring bill
            $this->billModel->create([
                'store_id'         => $storeId,
                'title'            => $proj['name'],
                'vendor'           => $matched['vendor'] ?? '',
                'vendor_id'        => null,
                'amount'           => null,
                'due_date'         => $nextDue,
                'note'             => $proj['description'] ?? '',
                'color'            => $proj['color'] ?? '',
                'category'         => $matched['category'],
                'repeat_type'      => 'monthly',
                'repeat_interval'  => 1,
                'repeat_anchor'    => null,
                'repeat_parent_id' => null,
                'created_by'       => $userId,
            ]);

            // Archive the source project
            $db->execute("UPDATE projects SET status = 'archived' WHERE id = ?", [$proj['id']]);
            $converted++;
        }

        flash('success', "{$converted} project(s) converted to recurring bills. {$skipped} skipped (no store or no match).");
        redirect('admin/data-hygiene');
    }

    /**
     * Admin-only: create 5 standard monthly recurring bills for the Raw Stockton store.
     * Safe to run multiple times — skips bills that already exist (same title + store + monthly).
     */
    public function seedRawStocktonBills() {
        if (!isAdmin()) { flash('error', 'Unauthorized'); redirect('bills'); return; }

        $db = Database::getInstance();

        // Find the Raw Stockton store
        $store = $db->fetch(
            "SELECT id, name FROM stores WHERE name LIKE '%Stockton%' OR name LIKE '%Raw%' ORDER BY id ASC LIMIT 1"
        );
        if (!$store) {
            flash('error', 'Store Raw Stockton không tìm thấy. Kiểm tra lại tên store.');
            redirect('bills');
            return;
        }
        $storeId = (int)$store['id'];
        $userId  = (int)$_SESSION['user_id'];

        // Helper: next occurrence of $day (day-of-month) from today
        $nextOccurrence = function($day) {
            $todayDay = (int)date('j');
            $year  = (int)date('Y');
            $month = (int)date('m');
            if ($todayDay < $day) {
                $safeDay = min($day, (int)date('t'));
            } else {
                $month++;
                if ($month > 12) { $month = 1; $year++; }
                $safeDay = min($day, (int)date('t', mktime(0, 0, 0, $month, 1, $year)));
            }
            return sprintf('%04d-%02d-%02d', $year, $month, $safeDay);
        };

        $billDefs = [
            ['title' => 'PG&E Electricity',   'vendor' => 'PG&E',       'due_day' => 20],
            ['title' => 'QuickBooks Tax',      'vendor' => 'QuickBooks',  'due_day' => 20],
            ['title' => 'Sales Tax',           'vendor' => 'CA CDTFA',    'due_day' => 20],
            ['title' => 'Lease Prepayment',    'vendor' => 'Landlord',    'due_day' => 1],
            ['title' => 'General Expenses',    'vendor' => null,          'due_day' => 1],
        ];

        $created = 0;
        $skipped = 0;

        foreach ($billDefs as $b) {
            // Skip if already exists (same title + store + monthly repeat)
            $exists = $db->fetch(
                "SELECT id FROM bills WHERE store_id = ? AND title = ? AND repeat_type = 'monthly'",
                [$storeId, $b['title']]
            );
            if ($exists) { $skipped++; continue; }

            $nextDue = $nextOccurrence($b['due_day']);

            $this->billModel->create([
                'store_id'        => $storeId,
                'title'           => $b['title'],
                'vendor'          => $b['vendor'] ?? '',
                'vendor_id'       => null,
                'amount'          => null,
                'due_date'        => $nextDue,
                'note'            => '',
                'color'           => '',
                'repeat_type'     => 'monthly',
                'repeat_interval' => 1,
                'repeat_anchor'   => null,
                'repeat_parent_id'=> null,
                'created_by'      => $userId,
            ]);
            $created++;
        }

        $msg = $created . ' recurring bill(s) tao thanh cong cho store "' . $store['name'] . '".';
        if ($skipped) $msg .= ' (' . $skipped . ' da ton tai, bo qua)';
        flash('success', $msg);
        redirect('bills/store/' . $storeId);
    }

    private function extractRepeatSettings($payload, $dueDate) {
        $type = strtolower(trim((string)($payload['repeat_type'] ?? 'none')));
        $allowedTypes = ['none', 'hourly', 'daily', 'weekly', 'monthly', 'yearly'];
        if (!in_array($type, $allowedTypes, true) || $type === 'none') {
            return [
                'repeat_type' => 'none',
                'repeat_interval' => 1,
                'repeat_anchor' => null,
            ];
        }

        $limits = [
            'hourly' => 24,
            'daily' => 30,
            'weekly' => 12,
            'monthly' => 12,
            'yearly' => 10,
        ];

        $interval = max(1, min($limits[$type] ?? 12, (int)($payload['repeat_interval'] ?? 1)));
        $defaultAnchor = $dueDate ? (int)date('G', strtotime($dueDate . ' 00:00:00')) : 0;
        $anchor = (int)($payload['repeat_anchor'] ?? $defaultAnchor);
        if ($type === 'hourly') {
            $anchor = max(0, min(23, $anchor));
        } else {
            $anchor = $anchor > 0 ? $anchor : null;
        }

        return [
            'repeat_type' => $type,
            'repeat_interval' => $interval,
            'repeat_anchor' => $anchor,
        ];
    }

    private function parseBillCategoriesFromPost(): array {
        $raw = $_POST['bill_categories'] ?? ($_POST['category'] ?? []);
        if (is_string($raw)) {
            $raw = $raw === '' ? [] : [$raw];
        }
        if (!is_array($raw)) {
            $raw = [];
        }

        $allowed = $this->billModel->allowedCategories();
        $clean = [];
        foreach ($raw as $category) {
            $category = strtolower(trim((string)$category));
            if ($category !== '' && in_array($category, $allowed, true)) {
                $clean[$category] = $category;
            }
        }

        return array_values($clean ?: ['general']);
    }

    /**
     * POST /bills/{id}/pay
     * Record a payment for a bill and mark it paid.
     * Supports JSON (AJAX) and standard form POST.
     */
    public function recordPayment($billId) {
        if (!isLoggedIn()) { json_response(['error' => 'Unauthorized'], 401); return; }

        $bill = $this->billModel->find($billId);
        if (!$bill) { json_response(['error' => 'Bill not found'], 404); return; }

        $raw = file_get_contents('php://input') ?: '';
        $jsonBody = [];
        if ($raw !== '' && stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== false) {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) $jsonBody = $decoded;
        }
        $input = array_merge($jsonBody, $_POST);

        $isAjax = (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest')
               || (!empty($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false);

        $paymentModel = new Payment();
        $paymentModel->create([
            'bill_id'    => (int)$billId,
            'amount'     => (float)($input['amount'] ?? $bill['amount'] ?? 0),
            'paid_at'    => !empty($input['paid_at']) ? $input['paid_at'] : date('Y-m-d H:i:s'),
            'method'     => $input['method']    ?? 'bank_transfer',
            'reference'  => $input['reference'] ?? null,
            'note'       => $input['note']      ?? null,
            'reviewer_id' => !empty($input['reviewer_id']) ? (int)$input['reviewer_id'] : ($bill['reviewer_id'] ?? null),
            'reviewer_due_date' => !empty($input['reviewer_due_date']) ? $input['reviewer_due_date'] : ($bill['reviewer_due_date'] ?? null),
            'review_instructions' => $input['review_instructions'] ?? ($bill['review_instructions'] ?? null),
            'verifier_user_id' => !empty($input['verifier_user_id']) ? (int)$input['verifier_user_id'] : null,
            'created_by' => (int)$_SESSION['user_id'],
        ]);

        // Mark bill paid
        $this->billModel->markPaid($billId);

        if ($isAjax) {
            json_response(['success' => true, 'bill_id' => (int)$billId]);
            return;
        }

        flash('success', 'Payment recorded — bill marked as paid');
        $referer = $_SERVER['HTTP_REFERER'] ?? APP_URL . '/bills';
        header("Location: $referer");
        exit;
    }

    /**
     * GET /api/bills/{id}/payments
     * Returns payment history for a bill (JSON).
     */
    public function apiPayments($billId) {
        if (!isLoggedIn()) { json_response(['error' => 'Unauthorized'], 401); return; }

        $bill = $this->billModel->find($billId);
        if (!$bill) { json_response(['error' => 'Not found'], 404); return; }

        $paymentModel = new Payment();
        $payments = $paymentModel->getForBill($billId);
        $total    = $paymentModel->totalForBill($billId);

        json_response([
            'bill_id'  => (int)$billId,
            'payments' => $payments,
            'total_paid' => $total,
        ]);
    }

    // ── Workflow API ──────────────────────────────────────────────────────────

    /**
     * POST /bills/{id}/workflow/{stage}
     * Valid stages: submit, verify, accept, confirm-withdrawal, complete, reject
     */
    public function workflowTransition($billId, $stage) {
        if (!isLoggedIn()) { json_response(['error' => 'Unauthorized'], 401); return; }

        $bill = $this->billModel->find($billId);
        if (!$bill) { json_response(['error' => 'Bill not found'], 404); return; }

        $db     = Database::getInstance();
        $userId = (int)$_SESSION['user_id'];
        $note   = trim($_POST['note'] ?? '');

        $stageMap = [
            'submit'              => 'submitted',
            'verify'              => 'checked',
            'accept'              => 'approved',
            'confirm-withdrawal'  => 'money_withdrawn',
            'complete'            => 'completed',
            'reject'              => 'rejected',
        ];

        if (!isset($stageMap[$stage])) {
            json_response(['error' => 'Invalid workflow stage'], 422);
            return;
        }

        $newStatus  = $stageMap[$stage];
        $oldStatus  = $bill['workflow_status'] ?? $bill['status'] ?? null;

        // Update workflow_status if column exists
        if ($db->columnExists('bills', 'workflow_status')) {
            $db->execute("UPDATE bills SET workflow_status = ? WHERE id = ?", [$newStatus, $billId]);
        }

        // Log to bill_history
        if ($db->tableExists('bill_history')) {
            $db->execute(
                "INSERT INTO bill_history (bill_id, user_id, action, old_status, new_status, note) VALUES (?, ?, ?, ?, ?, ?)",
                [$billId, $userId, 'workflow_' . $stage, $oldStatus, $newStatus, $note]
            );
        }

        json_response(['ok' => true, 'bill_id' => (int)$billId, 'stage' => $stage, 'new_status' => $newStatus]);
    }

    // ── Duplicate check API ───────────────────────────────────────────────────

    /**
     * POST /api/bills/check-duplicate
     */
    public function apiCheckDuplicate() {
        if (!isLoggedIn()) { json_response(['error' => 'Unauthorized'], 401); return; }

        $data = [
            'title'    => trim($_POST['title'] ?? ''),
            'store_id' => (int)($_POST['store_id'] ?? 0),
            'due_date' => $_POST['due_date'] ?? '',
            'amount'   => (float)($_POST['amount'] ?? 0),
            'vendor'   => trim($_POST['vendor'] ?? ''),
            'category' => trim($_POST['category'] ?? ''),
        ];

        $existing = DuplicateDetector::checkBillDuplicate($data);
        if (!$existing) {
            json_response(['duplicate' => false, 'match' => null, 'score' => 0]);
            return;
        }

        $score = DuplicateDetector::scoreMatch($existing, $data);

        json_response([
            'duplicate' => $score >= 70,
            'score'     => $score,
            'match'     => [
                'id'       => (int)$existing['id'],
                'title'    => $existing['title'],
                'store'    => $existing['store_name'] ?? null,
                'due_date' => substr($existing['due_date'] ?? '', 0, 10),
                'status'   => $existing['status'],
                'amount'   => (float)($existing['amount'] ?? 0),
            ],
        ]);
    }
}
