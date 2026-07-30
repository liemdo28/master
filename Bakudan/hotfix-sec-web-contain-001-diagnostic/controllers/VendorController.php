<?php
class VendorController {
    private $vendorModel;

    public function __construct() {
        $this->vendorModel = new Vendor();
    }

    public function index() {
        $this->vendorModel->syncFromBills();
        $vendors = $this->vendorModel->getAllWithOverview();
        // Load attachments for each vendor
        foreach ($vendors as &$v) {
            $v['attachments'] = $this->vendorModel->getAttachments($v['id']);
        }
        unset($v);
        require __DIR__ . '/../views/admin/vendors.php';
    }

    public function create() {
        if (!verify_csrf($_POST['csrf'] ?? '')) { flash('error', 'Invalid CSRF'); redirect('admin/vendors'); }
        $name = trim($_POST['name'] ?? '');
        if ($name === '') { flash('error', 'Vendor name is required'); redirect('admin/vendors'); }

        $vendorId = $this->vendorModel->createOrGet([
            'name' => $name,
            'payment_url' => trim($_POST['payment_url'] ?? ''),
            'login_info' => trim($_POST['login_info'] ?? ''),
            'notes' => trim($_POST['notes'] ?? ''),
        ]);
        if ($vendorId) {
            $this->vendorModel->syncBillsForVendor($vendorId, $name);
        }
        flash('success', 'Vendor created');
        redirect('admin/vendors');
    }

    public function update($id) {
        if (!verify_csrf($_POST['csrf'] ?? '')) { flash('error', 'Invalid CSRF'); redirect('admin/vendors'); }
        $vendor = $this->vendorModel->find($id);
        if (!$vendor) { flash('error', 'Vendor not found'); redirect('admin/vendors'); }

        $name = trim($_POST['name'] ?? '');
        if ($name === '') { flash('error', 'Vendor name is required'); redirect('admin/vendors'); }

        $oldName = $vendor['name'];
        $this->vendorModel->update($id, [
            'name' => $name,
            'payment_url' => trim($_POST['payment_url'] ?? ''),
            'login_info' => trim($_POST['login_info'] ?? ''),
            'notes' => trim($_POST['notes'] ?? ''),
        ]);
        $this->vendorModel->syncBillsForVendor($id, $name);
        if ($oldName !== $name) {
            $this->vendorModel->syncBillsForVendor($id, $name, $oldName);
        }
        flash('success', 'Vendor updated');
        redirect('admin/vendors');
    }

    public function delete($id) {
        $vendor = $this->vendorModel->find($id);
        if (!$vendor) { flash('error', 'Vendor not found'); redirect('admin/vendors'); }
        // Delete all attachments files
        $attachments = $this->vendorModel->getAttachments($id);
        foreach ($attachments as $att) {
            $filepath = UPLOAD_DIR . $att['filename'];
            if (file_exists($filepath)) unlink($filepath);
        }
        $this->vendorModel->delete($id);
        flash('success', 'Vendor deleted');
        redirect('admin/vendors');
    }

    public function upload($id) {
        $vendor = $this->vendorModel->find($id);
        if (!$vendor) json_response(['error' => 'Vendor not found'], 404);

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
            $attId = $this->vendorModel->addAttachment([
                'vendor_id' => $id,
                'filename' => $filename,
                'original_name' => $file['name'],
                'file_size' => $file['size'],
                'mime_type' => $file['type'],
            ]);
            json_response(['success' => true, 'id' => $attId, 'filename' => $file['name']]);
        }
        json_response(['error' => 'Upload failed'], 500);
    }

    public function deleteAttachment($attId) {
        $att = $this->vendorModel->deleteAttachment($attId);
        if (!$att) { flash('error', 'Attachment not found'); redirect('admin/vendors'); }
        flash('success', 'Attachment deleted');
        redirect('admin/vendors');
    }

    public function downloadAttachment($attId) {
        $att = $this->vendorModel->findAttachment($attId);
        if (!$att) { http_response_code(404); echo 'Not found'; exit; }

        $filepath = UPLOAD_DIR . $att['filename'];
        if (!file_exists($filepath)) { http_response_code(404); echo 'File not found'; exit; }

        header('Content-Type: ' . ($att['mime_type'] ?: 'application/octet-stream'));
        header('Content-Disposition: attachment; filename="' . $att['original_name'] . '"');
        header('Content-Length: ' . filesize($filepath));
        readfile($filepath);
        exit;
    }
}
