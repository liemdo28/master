<?php
class User {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }

    private function ensureSchema() {
        if (!$this->db->tableExists('users')) {
            return;
        }

        if (!$this->db->columnExists('users', 'store_id')) {
            try {
                $this->db->execute("ALTER TABLE users ADD COLUMN store_id INT NULL DEFAULT NULL AFTER role");
                $this->db->invalidateSchemaCache('users');
            } catch (Exception $e) {
            }
        }

        // Multi-store pivot table
        if (!$this->db->tableExists('user_stores')) {
            try {
                $this->db->execute("CREATE TABLE user_stores (
                    user_id INT NOT NULL,
                    store_id INT NOT NULL,
                    PRIMARY KEY (user_id, store_id),
                    KEY idx_us_store (store_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
                // Seed from existing users.store_id
                $this->db->execute("INSERT IGNORE INTO user_stores (user_id, store_id)
                    SELECT id, store_id FROM users WHERE store_id IS NOT NULL");
            } catch (Exception $e) {
            }
        }

        try {
            $roleColumn = $this->db->fetch(
                "SELECT COLUMN_TYPE FROM information_schema.columns
                 WHERE table_schema = ? AND table_name = 'users' AND column_name = 'role'
                 LIMIT 1",
                [DB_NAME]
            );
            if ($roleColumn && strpos($roleColumn['COLUMN_TYPE'] ?? '', 'manager') === false) {
                $this->db->execute("ALTER TABLE users MODIFY COLUMN role ENUM('ceo','admin','manager','member') DEFAULT 'member'");
            }
        } catch (Exception $e) {
        }

        if (!$this->db->columnExists('users', 'last_login_at')) {
            try {
                $this->db->execute("ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL DEFAULT NULL AFTER is_active");
                $this->db->invalidateSchemaCache('users');
            } catch (Exception $e) {
            }
        }

        if (!$this->db->columnExists('users', 'timezone')) {
            try {
                $this->db->execute("ALTER TABLE users ADD COLUMN timezone VARCHAR(64) NULL DEFAULT NULL AFTER preferred_language");
                $this->db->invalidateSchemaCache('users');
            } catch (Exception $e) {
            }
        }

        // Admin password control metadata. Passwords remain one-way hashes and are never shown in UI.
        if (!$this->db->columnExists('users', 'password_reset_by')) {
            try {
                $this->db->execute("ALTER TABLE users ADD COLUMN password_reset_by INT NULL DEFAULT NULL AFTER password");
                $this->db->invalidateSchemaCache('users');
            } catch (Exception $e) {
            }
        }
        if (!$this->db->columnExists('users', 'password_reset_at')) {
            try {
                $this->db->execute("ALTER TABLE users ADD COLUMN password_reset_at DATETIME NULL DEFAULT NULL AFTER password_reset_by");
                $this->db->invalidateSchemaCache('users');
            } catch (Exception $e) {
            }
        }
    }

    public function findById($id) {
        return $this->db->fetch("SELECT * FROM users WHERE id = ?", [$id]);
    }

    public function findByEmail($email) {
        $normalizedEmail = strtolower(trim($email));
        return $this->db->fetch("SELECT * FROM users WHERE LOWER(email) = ?", [$normalizedEmail]);
    }

    public function getAll() {
        $hasStoreId = $this->db->columnExists('users', 'store_id');
        $hasLastLogin = $this->db->columnExists('users', 'last_login_at');
        $hasPasswordResetAt = $this->db->columnExists('users', 'password_reset_at');
        $hasPasswordResetBy = $this->db->columnExists('users', 'password_reset_by');
        $canJoinStores = $hasStoreId && $this->db->tableExists('stores');
        $storeSelect = $hasStoreId ? ", u.store_id" : ", NULL AS store_id";
        $storeSelect .= $canJoinStores ? ", s.name AS store_name" : ", NULL AS store_name";
        $storeJoin = $canJoinStores ? " LEFT JOIN stores s ON s.id = u.store_id" : "";
        $lastLoginSelect = $hasLastLogin ? ", u.last_login_at" : ", NULL AS last_login_at";
        $passwordResetAtSelect = $hasPasswordResetAt ? ", u.password_reset_at" : ", NULL AS password_reset_at";
        $passwordResetBySelect = $hasPasswordResetBy ? ", u.password_reset_by" : ", NULL AS password_reset_by";

        return $this->db->fetchAll(
            "SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at{$lastLoginSelect}{$passwordResetAtSelect}{$passwordResetBySelect}{$storeSelect}
             FROM users u{$storeJoin}
             ORDER BY u.name"
        );
    }

    public function getActive() {
        return $this->db->fetchAll("SELECT id, name, email, avatar, role FROM users WHERE is_active = 1 ORDER BY name");
    }

    public function create($data) {
        $name = trim($data['name'] ?? '');
        $email = strtolower(trim($data['email'] ?? ''));
        $password = $data['password'] ?? '';
        $role = $data['role'] ?? 'member';
        $storeId = $data['store_id'] ?? null;

        if ($this->db->columnExists('users', 'store_id')) {
            return $this->db->insert(
                "INSERT INTO users (name, email, password, role, store_id, is_active) VALUES (?, ?, ?, ?, ?, 1)",
                [$name, $email, password_hash($password, PASSWORD_BCRYPT), $role, $storeId ?: null]
            );
        }

        return $this->db->insert(
            "INSERT INTO users (name, email, password, role, is_active) VALUES (?, ?, ?, ?, 1)",
            [$name, $email, password_hash($password, PASSWORD_BCRYPT), $role]
        );
    }

    public function update($id, $data) {
        $fields = [];
        $params = [];

        if (isset($data['name'])) {
            $fields[] = "name = ?";
            $params[] = trim($data['name']);
        }

        if (isset($data['email'])) {
            $fields[] = "email = ?";
            $params[] = strtolower(trim($data['email']));
        }

        foreach (['role', 'is_active', 'avatar', 'email_notifications', 'timezone', 'store_id'] as $field) {
            if (array_key_exists($field, $data)) {
                if ($field === 'store_id' && !$this->db->columnExists('users', 'store_id')) {
                    continue;
                }
                $fields[] = "$field = ?";
                $params[] = $field === 'store_id' && !$data[$field] ? null : $data[$field];
            }
        }

        if (isset($data['password']) && $data['password'] !== '') {
            $fields[] = "password = ?";
            $params[] = password_hash($data['password'], PASSWORD_BCRYPT);
            if ($this->db->columnExists('users', 'password_reset_at')) {
                $fields[] = "password_reset_at = NOW()";
            }
            if ($this->db->columnExists('users', 'password_reset_by')) {
                $fields[] = "password_reset_by = ?";
                $params[] = $data['password_reset_by'] ?? ($_SESSION['user_id'] ?? null);
            }
        }

        if (empty($fields)) {
            return false;
        }

        $params[] = $id;
        return $this->db->update("UPDATE users SET " . implode(', ', $fields) . " WHERE id = ?", $params);
    }

    /** Returns array of store IDs assigned to a user (from user_stores pivot). */
    public function getUserStoreIds(int $userId): array {
        if (!$this->db->tableExists('user_stores')) return [];
        $rows = $this->db->fetchAll("SELECT store_id FROM user_stores WHERE user_id = ? ORDER BY store_id", [$userId]);
        return array_column($rows, 'store_id');
    }

    /** Sync user_stores pivot and keep users.store_id = first assigned store. */
    public function syncUserStores(int $userId, array $storeIds): void {
        if (!$this->db->tableExists('user_stores')) return;
        $this->db->execute("DELETE FROM user_stores WHERE user_id = ?", [$userId]);
        foreach ($storeIds as $sid) {
            $sid = (int)$sid;
            if ($sid > 0) {
                $this->db->execute("INSERT IGNORE INTO user_stores (user_id, store_id) VALUES (?,?)", [$userId, $sid]);
            }
        }
        // Keep users.store_id = first selected (backward compat)
        $primary = !empty($storeIds) ? (int)$storeIds[0] : null;
        if ($this->db->columnExists('users', 'store_id')) {
            $this->db->execute("UPDATE users SET store_id = ? WHERE id = ?", [$primary, $userId]);
        }
    }

    public function delete($id) {
        // Keep task/audit history intact. Delete means deactivate from the admin UI.
        return $this->deactivate($id);
    }

    public function deactivate($id) {
        return $this->db->update("UPDATE users SET is_active = 0 WHERE id = ?", [$id]);
    }

    public function toggleActive($id) {
        return $this->db->update("UPDATE users SET is_active = NOT is_active WHERE id = ?", [$id]);
    }

    public function verify($email, $password) {
        $user = $this->findByEmail($email);

        if (!$user) return false;
        if (!isset($user['is_active']) || (int)$user['is_active'] !== 1) return false;

        $storedPassword = $user['password'] ?? '';
        if ($storedPassword === '') return false;

        // Password is already hashed (expected state).
        if (password_verify($password, $storedPassword)) {
            $this->recordLogin($user['id']);
            return $user;
        }

        // Legacy support: plain-text password in DB.
        // Allow once, then upgrade it to bcrypt hash.
        if ($password === $storedPassword) {
            $newHash = password_hash($password, PASSWORD_BCRYPT);
            $this->db->update("UPDATE users SET password = ? WHERE id = ?", [$newHash, $user['id']]);
            $user['password'] = $newHash;
            $this->recordLogin($user['id']);
            return $user;
        }

        return false;
    }

    private function recordLogin($id) {
        if (!$this->db->columnExists('users', 'last_login_at')) {
            return;
        }
        try {
            $this->db->update("UPDATE users SET last_login_at = NOW() WHERE id = ?", [$id]);
        } catch (Exception $e) {
        }
    }

    public function count() {
        $result = $this->db->fetch("SELECT COUNT(*) as total FROM users WHERE is_active = 1");
        return $result['total'] ?? 0;
    }
}
