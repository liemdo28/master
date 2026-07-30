<?php
/**
 * ShiftController - Shift Management
 */
require_once __DIR__ . '/../models/Shift.php';

class ShiftController
{
    private $shiftModel;

    public function __construct()
    {
        $this->shiftModel = new Shift();
    }

    private function requireAdmin(): void
    {
        if (!canAdmin()) { header('Location: /dashboard'); exit; }
    }

    public function index(): void
    {
        $this->requireAdmin();
        $filters = [
            'store_id' => $_GET['store_id'] ?? '',
            'status' => $_GET['status'] ?? '',
            'from_date' => $_GET['from_date'] ?? date('Y-m-d'),
            'to_date' => $_GET['to_date'] ?? date('Y-m-d', strtotime('+7 days')),
        ];
        $shifts = $this->shiftModel->all(array_filter($filters), 100, 0);
        $stats = $this->shiftModel->getStats();
        $stores = Database::getInstance()->fetchAll("SELECT id, name FROM stores ORDER BY name");
        $users = Database::getInstance()->fetchAll("SELECT id, name FROM users WHERE is_active = 1 ORDER BY name");

        extract(['shifts' => $shifts, 'stats' => $stats, 'stores' => $stores, 'users' => $users, 'filters' => $filters]);
        $currentPage = 'admin-shifts';
        $flash = $_SESSION['flash'] ?? null; unset($_SESSION['flash']);
        include __DIR__ . '/../views/admin/shifts/index.php';
    }

    public function store(): void
    {
        $this->requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header('Location: /admin/shifts'); exit; }

        $data = [
            'store_id' => !empty($_POST['store_id']) ? (int)$_POST['store_id'] : null,
            'user_id' => !empty($_POST['user_id']) ? (int)$_POST['user_id'] : null,
            'shift_date' => $_POST['shift_date'] ?? date('Y-m-d'),
            'start_time' => $_POST['start_time'] ?? '09:00',
            'end_time' => $_POST['end_time'] ?? '17:00',
            'role' => trim($_POST['role'] ?? ''),
            'notes' => trim($_POST['notes'] ?? ''),
        ];

        $this->shiftModel->create($data);
        $_SESSION['flash'] = ['type' => 'success', 'message' => 'Shift created'];
        header('Location: /admin/shifts');
        exit;
    }

    public function update(int $id): void
    {
        $this->requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header("Location: /admin/shifts"); exit; }
        $data = array_filter([
            'store_id' => !empty($_POST['store_id']) ? (int)$_POST['store_id'] : null,
            'user_id' => !empty($_POST['user_id']) ? (int)$_POST['user_id'] : null,
            'shift_date' => $_POST['shift_date'] ?? null,
            'start_time' => $_POST['start_time'] ?? null,
            'end_time' => $_POST['end_time'] ?? null,
            'role' => $_POST['role'] ?? null,
            'status' => $_POST['status'] ?? null,
            'notes' => $_POST['notes'] ?? null,
        ], fn($v) => $v !== null);
        $this->shiftModel->update($id, $data);
        $_SESSION['flash'] = ['type' => 'success', 'message' => 'Shift updated'];
        header('Location: /admin/shifts');
        exit;
    }

    public function delete(int $id): void
    {
        $this->requireAdmin();
        $this->shiftModel->delete($id);
        $_SESSION['flash'] = ['type' => 'success', 'message' => 'Shift deleted'];
        header('Location: /admin/shifts');
        exit;
    }

    public function apiStats(): void
    {
        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'data' => $this->shiftModel->getStats()]);
    }
}
