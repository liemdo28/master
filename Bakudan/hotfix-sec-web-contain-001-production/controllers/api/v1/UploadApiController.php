<?php
/**
 * API v1 - Upload Endpoints
 * POST /api/v1/upload
 * GET /api/v1/files/{id}
 */
require_once __DIR__ . '/ApiController.php';
require_once __DIR__ . '/../../../models/Task.php';

class UploadApiController extends ApiController {

    // ── POST /api/v1/upload ──────────────────────────────────────
    public function upload() {
        $this->requireAuth();

        if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            $errorMessages = [
                UPLOAD_ERR_INI_SIZE   => 'File exceeds server limit',
                UPLOAD_ERR_FORM_SIZE  => 'File exceeds form limit',
                UPLOAD_ERR_PARTIAL    => 'File was only partially uploaded',
                UPLOAD_ERR_NO_FILE    => 'No file was uploaded',
            ];
            $err = $_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE;
            api_error($errorMessages[$err] ?? 'Upload failed', 400);
        }

        $file = $_FILES['file'];
        $taskId = !empty($_POST['task_id']) ? (int)$_POST['task_id'] : null;
        if ($taskId && !(new Task())->canEdit($taskId, $this->userId)) {
            api_error('Access denied', 403);
        }

        // Validate size
        if ($file['size'] > MAX_UPLOAD_SIZE) {
            api_error('File too large. Maximum: ' . (MAX_UPLOAD_SIZE / 1024 / 1024) . 'MB', 400);
        }

        // Validate MIME type
        $allowedMimes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain', 'text/csv',
            'application/zip', 'application/x-zip-compressed',
        ];

        $mime = $file['type'] ?? '';
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

        // Additional check: detect actual mime
        $finfo = null;
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime = finfo_file($finfo, $file['tmp_name']);
        }

        // Block dangerous files
        $dangerousExts = ['php', 'phtml', 'php3', 'php4', 'php5', 'phar', 'exe', 'sh', 'bat', 'cmd'];
        if (in_array($ext, $dangerousExts)) {
            api_error('File type not allowed', 400);
        }

        if ($mime && !in_array($mime, $allowedMimes) && !str_starts_with($mime, 'image/')) {
            api_error('File type not allowed', 400);
        }

        // Create upload dir
        $uploadDir = defined('UPLOAD_DIR') ? UPLOAD_DIR : __DIR__ . '/../../../uploads/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        // Generate unique filename
        $filename = bin2hex(random_bytes(16)) . '_' . time() . '.' . $ext;
        $destPath = $uploadDir . $filename;

        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            api_error('Failed to save file', 500);
        }

        if ($finfo) finfo_close($finfo);

        // Nếu có task_id → lưu vào attachments
        if ($taskId) {
            $attId = $this->db->insert(
                "INSERT INTO attachments (task_id, user_id, filename, original_name, file_size, mime_type)
                 VALUES (?, ?, ?, ?, ?, ?)",
                [$taskId, $this->userId, $filename, $file['name'], $file['size'], $mime]
            );

            $this->auditLog('file_uploaded', 'task', $taskId, [
                'filename' => $filename,
                'original_name' => $file['name'],
            ]);

            api_response([
                'id'           => (int)$attId,
                'filename'     => $filename,
                'original_name'=> $file['name'],
                'file_size'    => $file['size'],
                'mime_type'    => $mime,
                'url'          => rtrim(APP_URL, '/') . '/attachments/' . $attId . '/download',
            ], 'File uploaded', 201);
        }

        // Không có task_id → chỉ upload file tự do
        api_response([
            'filename'     => $filename,
            'original_name'=> $file['name'],
            'file_size'    => $file['size'],
            'mime_type'    => $mime,
            'url'          => rtrim(APP_URL, '/') . '/uploads/' . $filename,
        ], 'File uploaded', 201);
    }
}
