<?php
/**
 * IncidentController - Incident Management System
 */
require_once __DIR__ . '/../models/Incident.php';
require_once __DIR__ . '/../models/Store.php';
require_once __DIR__ . '/../models/User.php';

class IncidentController
{
    private $incidentModel;
    private $storeModel;
    private $userModel;
    
    public function __construct()
    {
        try { $this->incidentModel = new Incident(); } catch (\Throwable $e) { error_log('[Incidents] model: ' . $e->getMessage()); $this->incidentModel = null; }
        try { $this->storeModel = new Store(); } catch (\Throwable $e) { $this->storeModel = null; }
        try { $this->userModel = new User(); } catch (\Throwable $e) { $this->userModel = null; }
    }
    
    private function requireAuth(): void
    {
        if (session_status() === PHP_SESSION_NONE) session_start();
        if (empty($_SESSION['user_id'])) {
            header('Location: /login');
            exit;
        }
    }
    
    private function requireRole(string $role): void
    {
        $this->requireAuth();
        $userRole = $_SESSION['user_role'] ?? '';
        if ($userRole !== $role && $userRole !== 'admin' && $userRole !== 'ceo') {
            header('Location: /dashboard');
            exit;
        }
    }
    
    public function index(): void
    {
        $this->requireRole('admin');
        
        $filters = [];
        $filters['status'] = $_GET['status'] ?? '';
        $filters['severity'] = $_GET['severity'] ?? '';
        $filters['store_id'] = $_GET['store_id'] ?? '';
        $filters['search'] = $_GET['search'] ?? '';
        $filters['from_date'] = $_GET['from_date'] ?? '';
        $filters['to_date'] = $_GET['to_date'] ?? '';
        
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = 20;
        $offset = ($page - 1) * $limit;
        
        $incidents = []; $total = 0; $stats = []; $stores = []; $users = [];
        if ($this->incidentModel) {
            try { $incidents = $this->incidentModel->getAll($filters, $limit, $offset); } catch (\Throwable $e) { error_log('[Incidents] getAll: ' . $e->getMessage()); }
            try { $total = $this->incidentModel->countAll($filters); } catch (\Throwable $e) {}
            try { $stats = $this->incidentModel->getStats(); } catch (\Throwable $e) {}
        }
        if ($this->storeModel) { try { $stores = $this->storeModel->allActive(); } catch (\Throwable $e) {} }
        if ($this->userModel) { try { $users = $this->userModel->getActive(); } catch (\Throwable $e) {} }
        
        $data = [
            'incidents' => $incidents,
            'stats' => $stats,
            'stores' => $stores,
            'users' => $users,
            'filters' => $filters,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'total_pages' => ceil($total / $limit)
            ]
        ];
        
        $this->render('admin/incidents/index', $data);
    }
    
    public function show(int $id): void
    {
        $this->requireAuth();
        
        $incident = $this->incidentModel->findById($id);
        if (!$incident) {
            $_SESSION['flash'] = ['type' => 'error', 'message' => 'Incident not found'];
            header('Location: /admin/incidents');
            exit;
        }
        
        // Check access
        if (!$this->incidentModel->canUserAccess($id, $_SESSION['user_id'], $_SESSION['role'])) {
            header('Location: /dashboard');
            exit;
        }
        
        $timeline = $this->incidentModel->getTimeline($id);
        $attachments = $this->incidentModel->getAttachments($id);
        $stores = $this->storeModel->allActive();
        $users = $this->userModel->getActive();
        
        $this->render('admin/incidents/show', [
            'incident' => $incident,
            'timeline' => $timeline,
            'attachments' => $attachments,
            'stores' => $stores,
            'users' => $users
        ]);
    }
    
    public function create(): void
    {
        $this->requireAuth();
        
        $stores = $this->storeModel->allActive();
        $users = $this->userModel->getActive();
        
        $this->render('admin/incidents/create', [
            'stores' => $stores,
            'users' => $users
        ]);
    }
    
    public function store(): void
    {
        $this->requireAuth();
        
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            header('Location: /admin/incidents/create');
            exit;
        }
        
        $data = [
            'title' => trim($_POST['title'] ?? ''),
            'description' => trim($_POST['description'] ?? ''),
            'store_id' => !empty($_POST['store_id']) ? (int)$_POST['store_id'] : null,
            'reported_by' => $_SESSION['user_id'],
            'assigned_to' => !empty($_POST['assigned_to']) ? (int)$_POST['assigned_to'] : null,
            'severity' => $_POST['severity'] ?? 'medium',
            'category' => trim($_POST['category'] ?? ''),
            'impact' => trim($_POST['impact'] ?? '')
        ];
        
        if (empty($data['title'])) {
            $_SESSION['flash'] = ['type' => 'error', 'message' => 'Title is required'];
            header('Location: /admin/incidents/create');
            exit;
        }
        
        $incidentId = $this->incidentModel->create($data);
        
        // Handle file attachments
        if (!empty($_FILES['attachments']['name'][0])) {
            $this->handleAttachments($incidentId);
        }
        
        $_SESSION['flash'] = ['type' => 'success', 'message' => 'Incident created successfully'];
        header("Location: /admin/incidents/$incidentId");
        exit;
    }
    
    public function update(int $id): void
    {
        $this->requireAuth();
        
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            header("Location: /admin/incidents/$id");
            exit;
        }
        
        $incident = $this->incidentModel->findById($id);
        if (!$incident) {
            header('Location: /admin/incidents');
            exit;
        }
        
        $data = [
            'title' => trim($_POST['title'] ?? ''),
            'description' => trim($_POST['description'] ?? ''),
            'store_id' => !empty($_POST['store_id']) ? (int)$_POST['store_id'] : null,
            'assigned_to' => !empty($_POST['assigned_to']) ? (int)$_POST['assigned_to'] : null,
            'severity' => $_POST['severity'] ?? 'medium',
            'category' => trim($_POST['category'] ?? ''),
            'impact' => trim($_POST['impact'] ?? '')
        ];
        
        $this->incidentModel->update($id, $data);
        
        // Handle file attachments
        if (!empty($_FILES['attachments']['name'][0])) {
            $this->handleAttachments($id);
        }
        
        $_SESSION['flash'] = ['type' => 'success', 'message' => 'Incident updated successfully'];
        header("Location: /admin/incidents/$id");
        exit;
    }
    
    public function acknowledge(int $id): void
    {
        $this->requireAuth();
        $this->incidentModel->acknowledge($id, $_SESSION['user_id']);
        $_SESSION['flash'] = ['type' => 'success', 'message' => 'Incident acknowledged'];
        header("Location: /admin/incidents/$id");
        exit;
    }
    
    public function investigate(int $id): void
    {
        $this->requireAuth();
        $this->incidentModel->investigate($id, $_SESSION['user_id']);
        $_SESSION['flash'] = ['type' => 'success', 'message' => 'Investigation started'];
        header("Location: /admin/incidents/$id");
        exit;
    }
    
    public function resolve(int $id): void
    {
        $this->requireAuth();
        
        $this->incidentModel->resolve(
            $id,
            $_SESSION['user_id'],
            $_POST['root_cause'] ?? null,
            $_POST['corrective_action'] ?? null
        );
        
        $_SESSION['flash'] = ['type' => 'success', 'message' => 'Incident resolved'];
        header("Location: /admin/incidents/$id");
        exit;
    }
    
    public function close(int $id): void
    {
        $this->requireAuth();
        $this->incidentModel->close($id, $_SESSION['user_id']);
        $_SESSION['flash'] = ['type' => 'success', 'message' => 'Incident closed'];
        header("Location: /admin/incidents/$id");
        exit;
    }
    
    public function cancel(int $id): void
    {
        $this->requireRole('admin');
        
        $reason = trim($_POST['reason'] ?? 'Cancelled');
        $this->incidentModel->cancel($id, $_SESSION['user_id'], $reason);
        
        $_SESSION['flash'] = ['type' => 'success', 'message' => 'Incident cancelled'];
        header("Location: /admin/incidents/$id");
        exit;
    }
    
    public function escalate(int $id): void
    {
        $this->requireRole('admin');
        
        $newLevel = (int)($_POST['level'] ?? 1);
        $reason = trim($_POST['reason'] ?? '');
        
        $this->incidentModel->escalate($id, $_SESSION['user_id'], $newLevel, $reason);
        
        $_SESSION['flash'] = ['type' => 'success', 'message' => 'Incident escalated'];
        header("Location: /admin/incidents/$id");
        exit;
    }
    
    public function assign(int $id): void
    {
        $this->requireAuth();
        
        $assignTo = (int)($_POST['assign_to'] ?? 0);
        if ($assignTo <= 0) {
            header("Location: /admin/incidents/$id");
            exit;
        }
        
        $this->incidentModel->assign($id, $assignTo, $_SESSION['user_id']);
        
        $_SESSION['flash'] = ['type' => 'success', 'message' => 'Incident assigned'];
        header("Location: /admin/incidents/$id");
        exit;
    }
    
    public function addComment(int $id): void
    {
        $this->requireAuth();
        
        $comment = trim($_POST['comment'] ?? '');
        if (empty($comment)) {
            header("Location: /admin/incidents/$id");
            exit;
        }
        
        $this->incidentModel->addComment($id, $_SESSION['user_id'], $comment);
        
        $_SESSION['flash'] = ['type' => 'success', 'message' => 'Comment added'];
        header("Location: /admin/incidents/$id");
        exit;
    }
    
    public function deleteAttachment(int $id): void
    {
        $this->requireRole('admin');
        
        $this->incidentModel->deleteAttachment($id);
        
        if (isset($_SERVER['HTTP_REFERER'])) {
            header('Location: ' . $_SERVER['HTTP_REFERER']);
        } else {
            header('Location: /admin/incidents');
        }
        exit;
    }
    
    // API Endpoints
    public function apiList(): void
    {
        header('Content-Type: application/json');
        
        try {
            $filters = [
                'status' => $_GET['status'] ?? '',
                'severity' => $_GET['severity'] ?? '',
                'store_id' => !empty($_GET['store_id']) ? (int)$_GET['store_id'] : null,
                'search' => $_GET['search'] ?? ''
            ];
            
            $page = max(1, (int)($_GET['page'] ?? 1));
            $limit = min(100, (int)($_GET['limit'] ?? 20));
            $offset = ($page - 1) * $limit;
            
            $incidents = $this->incidentModel->getAll($filters, $limit, $offset);
            $total = $this->incidentModel->countAll($filters);
            
            echo json_encode([
                'success' => true,
                'data' => $incidents,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total,
                    'total_pages' => ceil($total / $limit)
                ]
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    
    public function apiStats(): void
    {
        header('Content-Type: application/json');
        
        try {
            $stats = $this->incidentModel->getStats();
            echo json_encode(['success' => true, 'data' => $stats]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }
    
    private function handleAttachments(int $incidentId): void
    {
        $uploadDir = __DIR__ . '/../uploads/incidents/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        
        foreach ($_FILES['attachments']['name'] as $key => $name) {
            if ($_FILES['attachments']['error'][$key] !== UPLOAD_ERR_OK) {
                continue;
            }
            
            $tmpName = $_FILES['attachments']['tmp_name'][$key];
            $originalName = basename($name);
            $filename = uniqid() . '_' . $originalName;
            $filepath = $uploadDir . $filename;
            
            if (move_uploaded_file($tmpName, $filepath)) {
                $this->incidentModel->addAttachment($incidentId, [
                    'filename' => $originalName,
                    'filepath' => '/uploads/incidents/' . $filename,
                    'file_type' => mime_content_type($filepath),
                    'uploaded_by' => $_SESSION['user_id']
                ]);
            }
        }
    }
    
    private function render(string $view, array $data = []): void
    {
        extract($data);
        $flash = $_SESSION['flash'] ?? null;
        unset($_SESSION['flash']);
        $pageTitle   = $title ?? 'Incidents';
        $currentPage = 'incidents';
        ob_start();
        include __DIR__ . '/../views/' . $view . '.php';
        $content = ob_get_clean();
        require __DIR__ . '/../views/layouts/main.php';
    }
}
