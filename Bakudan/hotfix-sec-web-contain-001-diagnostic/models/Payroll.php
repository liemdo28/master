<?php
/**
 * Payroll Model - Payroll Management System
 */
class Payroll
{
    private $db;
    
    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->ensureSchema();
    }
    
    private function ensureSchema(): void
    {
        if (!$this->db->tableExists('payroll_runs')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS payroll_runs (
                    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    name            VARCHAR(255) NOT NULL,
                    period_start    DATE NOT NULL,
                    period_end      DATE NOT NULL,
                    status          ENUM('draft','processing','completed','cancelled') NOT NULL DEFAULT 'draft',
                    created_by      INT UNSIGNED DEFAULT NULL,
                    processed_by    INT UNSIGNED DEFAULT NULL,
                    processed_at    DATETIME DEFAULT NULL,
                    total_gross     DECIMAL(12,2) DEFAULT 0,
                    total_deductions DECIMAL(12,2) DEFAULT 0,
                    total_net       DECIMAL(12,2) DEFAULT 0,
                    notes           TEXT DEFAULT NULL,
                    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_payroll_runs_status (status),
                    INDEX idx_payroll_runs_period (period_start, period_end)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }
        
        if (!$this->db->tableExists('payroll_employees')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS payroll_employees (
                    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    payroll_run_id      INT UNSIGNED NOT NULL,
                    employee_id         INT UNSIGNED NOT NULL,
                    store_id           INT UNSIGNED DEFAULT NULL,
                    base_salary        DECIMAL(10,2) NOT NULL DEFAULT 0,
                    days_worked        INT DEFAULT 0,
                    overtime_hours     DECIMAL(5,2) DEFAULT 0,
                    overtime_rate      DECIMAL(10,2) DEFAULT 0,
                    bonus              DECIMAL(10,2) DEFAULT 0,
                    gross_pay          DECIMAL(10,2) DEFAULT 0,
                    tax_deduction      DECIMAL(10,2) DEFAULT 0,
                    insurance_deduction DECIMAL(10,2) DEFAULT 0,
                    other_deductions   DECIMAL(10,2) DEFAULT 0,
                    net_pay            DECIMAL(10,2) DEFAULT 0,
                    status             ENUM('pending','approved','paid') NOT NULL DEFAULT 'pending',
                    paid_at            DATETIME DEFAULT NULL,
                    notes              TEXT DEFAULT NULL,
                    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_payroll_emp_run (payroll_run_id),
                    INDEX idx_payroll_emp_employee (employee_id),
                    INDEX idx_payroll_emp_store (store_id),
                    CONSTRAINT fk_payroll_run FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }
        
        if (!$this->db->tableExists('payroll_employees')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS payroll_employees (
                    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    payroll_run_id      INT UNSIGNED NOT NULL,
                    employee_id         INT UNSIGNED NOT NULL,
                    store_id           INT UNSIGNED DEFAULT NULL,
                    base_salary        DECIMAL(10,2) NOT NULL DEFAULT 0,
                    days_worked        INT DEFAULT 0,
                    overtime_hours     DECIMAL(5,2) DEFAULT 0,
                    overtime_rate      DECIMAL(10,2) DEFAULT 0,
                    bonus              DECIMAL(10,2) DEFAULT 0,
                    gross_pay          DECIMAL(10,2) DEFAULT 0,
                    tax_deduction      DECIMAL(10,2) DEFAULT 0,
                    insurance_deduction DECIMAL(10,2) DEFAULT 0,
                    other_deductions   DECIMAL(10,2) DEFAULT 0,
                    net_pay            DECIMAL(10,2) DEFAULT 0,
                    status             ENUM('pending','approved','paid') NOT NULL DEFAULT 'pending',
                    paid_at            DATETIME DEFAULT NULL,
                    notes              TEXT DEFAULT NULL,
                    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_payroll_emp_run (payroll_run_id),
                    INDEX idx_payroll_emp_employee (employee_id),
                    INDEX idx_payroll_emp_store (store_id),
                    CONSTRAINT fk_payroll_run FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }
        
        if (!$this->db->tableExists('payroll_adjustments')) {
            $this->db->execute("
                CREATE TABLE IF NOT EXISTS payroll_adjustments (
                    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    payroll_run_id  INT UNSIGNED NOT NULL,
                    employee_id     INT UNSIGNED NOT NULL,
                    type            ENUM('bonus','deduction','correction','allowance') NOT NULL,
                    amount          DECIMAL(10,2) NOT NULL,
                    description     VARCHAR(255) DEFAULT NULL,
                    created_by      INT UNSIGNED DEFAULT NULL,
                    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_adjustments_run (payroll_run_id),
                    INDEX idx_adjustments_employee (employee_id),
                    CONSTRAINT fk_adjustments_run FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }
    }
    
    public function createPayrollRun(array $data): int
    {
        $this->db->execute("
            INSERT INTO payroll_runs (name, period_start, period_end, created_by, notes)
            VALUES (?, ?, ?, ?, ?)
        ", [
            $data['name'] ?? '',
            $data['period_start'],
            $data['period_end'],
            $data['created_by'] ?? null,
            $data['notes'] ?? null
        ]);
        
        return (int)$this->db->getConnection()->lastInsertId();
    }
    
    public function findPayrollRun(int $id): ?array
    {
        $run = $this->db->fetch("
            SELECT p.*, u1.name as created_by_name, u2.name as processed_by_name
            FROM payroll_runs p
            LEFT JOIN users u1 ON p.created_by = u1.id
            LEFT JOIN users u2 ON p.processed_by = u2.id
            WHERE p.id = ?
        ", [$id]);
        
        return $run ?: null;
    }
    
    public function getAllPayrollRuns(int $limit = 50, int $offset = 0): array
    {
        return $this->db->fetchAll("
            SELECT p.*, u1.name as created_by_name,
                   (SELECT COUNT(*) FROM payroll_employees WHERE payroll_run_id = p.id) as employee_count
            FROM payroll_runs p
            LEFT JOIN users u1 ON p.created_by = u1.id
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        ", [$limit, $offset]);
    }
    
    public function countPayrollRuns(): int
    {
        $row = $this->db->fetch("SELECT COUNT(*) as cnt FROM payroll_runs");
        return (int)($row['cnt'] ?? 0);
    }
    
    public function updatePayrollRun(int $id, array $data): bool
    {
        $allowed = ['name', 'period_start', 'period_end', 'status', 'notes'];
        $updates = [];
        $params = [];
        
        foreach ($allowed as $field) {
            if (isset($data[$field])) {
                $updates[] = "$field = ?";
                $params[] = $data[$field];
            }
        }
        
        if (empty($updates)) return false;
        
        $params[] = $id;
        return $this->db->execute("UPDATE payroll_runs SET " . implode(', ', $updates) . " WHERE id = ?", $params) > 0;
    }
    
    public function processPayrollRun(int $id, int $userId): bool
    {
        $run = $this->findPayrollRun($id);
        if (!$run) return false;
        
        // Get all employees
        $employees = $this->db->fetchAll("
            SELECT u.id, u.name, u.salary, us.store_id, 
                   COALESCE(us.days_worked, 22) as days_worked,
                   COALESCE(us.overtime_hours, 0) as overtime_hours,
                   COALESCE(us.overtime_rate, 1.5) as overtime_rate
            FROM users u
            LEFT JOIN user_stores us ON u.id = us.user_id
            WHERE u.role IN ('member', 'manager') AND u.is_active = 1
        ");
        
        foreach ($employees as $emp) {
            $baseSalary = $emp['salary'] ?? 0;
            $daysWorked = $emp['days_worked'] ?? 22;
            $dailyRate = $baseSalary / 22;
            $earned = $dailyRate * $daysWorked;
            
            $overtimeHours = $emp['overtime_hours'] ?? 0;
            $overtimeRate = $emp['overtime_rate'] ?? 1.5;
            $overtimePay = ($dailyRate / 8) * $overtimeHours * $overtimeRate;
            
            $grossPay = $earned + $overtimePay;
            
            // Tax calculation (simplified)
            $taxRate = 0.1; // 10% flat tax
            $taxDeduction = $grossPay * $taxRate;
            
            // Insurance
            $insuranceRate = 0.08; // 8%
            $insuranceDeduction = $grossPay * $insuranceRate;
            
            $netPay = $grossPay - $taxDeduction - $insuranceDeduction;
            
            // Insert payroll employee
            $this->db->execute("
                INSERT INTO payroll_employees 
                (payroll_run_id, employee_id, store_id, base_salary, days_worked, overtime_hours, overtime_rate, gross_pay, tax_deduction, insurance_deduction, net_pay)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ", [$id, $emp['id'], $emp['store_id'], $baseSalary, $daysWorked, $overtimeHours, $overtimeRate, $grossPay, $taxDeduction, $insuranceDeduction, $netPay]);
        }
        
        // Update totals
        $this->db->execute("
            UPDATE payroll_runs SET
                total_gross = (SELECT SUM(gross_pay) FROM payroll_employees WHERE payroll_run_id = ?),
                total_deductions = (SELECT SUM(tax_deduction + insurance_deduction) FROM payroll_employees WHERE payroll_run_id = ?),
                total_net = (SELECT SUM(net_pay) FROM payroll_employees WHERE payroll_run_id = ?),
                status = 'processing'
            WHERE id = ?
        ", [$id, $id, $id, $id]);
        
        return true;
    }
    
    public function completePayrollRun(int $id, int $userId): bool
    {
        $this->db->execute("
            UPDATE payroll_runs SET
                status = 'completed',
                processed_by = ?,
                processed_at = NOW()
            WHERE id = ? AND status = 'processing'
        ", [$userId, $id]);
        
        return true;
    }
    
    public function getPayrollEmployees(int $runId): array
    {
        return $this->db->fetchAll("
            SELECT pe.*, u.name as employee_name, u.email, s.name as store_name
            FROM payroll_employees pe
            JOIN users u ON pe.employee_id = u.id
            LEFT JOIN stores s ON pe.store_id = s.id
            WHERE pe.payroll_run_id = ?
            ORDER BY pe.net_pay DESC
        ", [$runId]);
    }
    
    public function findPayrollEmployee(int $id): ?array
    {
        return $this->db->fetch("
            SELECT pe.*, u.name as employee_name, u.email, s.name as store_name,
                   p.name as payroll_name, p.period_start, p.period_end
            FROM payroll_employees pe
            JOIN users u ON pe.employee_id = u.id
            LEFT JOIN stores s ON pe.store_id = s.id
            JOIN payroll_runs p ON pe.payroll_run_id = p.id
            WHERE pe.id = ?
        ", [$id]) ?: null;
    }
    
    public function updatePayrollEmployee(int $id, array $data): bool
    {
        $allowed = ['days_worked', 'overtime_hours', 'overtime_rate', 'bonus', 'gross_pay', 'tax_deduction', 'insurance_deduction', 'other_deductions', 'net_pay', 'status', 'notes'];
        $updates = [];
        $params = [];
        
        foreach ($allowed as $field) {
            if (isset($data[$field])) {
                $updates[] = "$field = ?";
                $params[] = $data[$field];
            }
        }
        
        if (empty($updates)) return false;
        
        // Recalculate gross and net if relevant fields changed
        if (isset($data['gross_pay']) || isset($data['tax_deduction']) || isset($data['insurance_deduction'])) {
            $emp = $this->findPayrollEmployee($id);
            if ($emp) {
                $gross = $data['gross_pay'] ?? $emp['gross_pay'];
                $tax = $data['tax_deduction'] ?? $emp['tax_deduction'];
                $insurance = $data['insurance_deduction'] ?? $emp['insurance_deduction'];
                $other = $data['other_deductions'] ?? $emp['other_deductions'];
                $bonus = $data['bonus'] ?? $emp['bonus'];
                
                $netPay = $gross + $bonus - $tax - $insurance - $other;
                
                $updates[] = "net_pay = ?";
                $params[] = $netPay;
            }
        }
        
        $params[] = $id;
        return $this->db->execute("UPDATE payroll_employees SET " . implode(', ', $updates) . " WHERE id = ?", $params) > 0;
    }
    
    public function markAsPaid(int $id): bool
    {
        return $this->db->execute("
            UPDATE payroll_employees SET status = 'paid', paid_at = NOW() WHERE id = ?
        ", [$id]) > 0;
    }
    
    public function markBatchAsPaid(array $ids): int
    {
        if (empty($ids)) return 0;
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        return $this->db->execute("
            UPDATE payroll_employees SET status = 'paid', paid_at = NOW() 
            WHERE id IN ($placeholders)
        ", $ids);
    }
    
    public function addAdjustment(int $runId, int $employeeId, array $data): int
    {
        $this->db->execute("
            INSERT INTO payroll_adjustments (payroll_run_id, employee_id, type, amount, description, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
        ", [
            $runId,
            $employeeId,
            $data['type'],
            $data['amount'],
            $data['description'] ?? null,
            $data['created_by'] ?? null
        ]);
        
        // Update employee net pay
        $emp = $this->db->fetch("
            SELECT * FROM payroll_employees WHERE payroll_run_id = ? AND employee_id = ?
        ", [$runId, $employeeId]);
        
        if ($emp) {
            $adjustment = $data['type'] === 'deduction' ? -abs($data['amount']) : abs($data['amount']);
            $newNet = $emp['net_pay'] + $adjustment;
            $newGross = $data['type'] === 'bonus' ? $emp['gross_pay'] + $adjustment : $emp['gross_pay'];
            
            $this->db->execute("
                UPDATE payroll_employees SET net_pay = ?, gross_pay = ? WHERE id = ?
            ", [$newNet, $newGross, $emp['id']]);
        }
        
        return (int)$this->db->getConnection()->lastInsertId();
    }
    
    public function getAdjustments(int $runId, ?int $employeeId = null): array
    {
        $sql = "
            SELECT a.*, u.name as employee_name, u1.name as created_by_name
            FROM payroll_adjustments a
            JOIN users u ON a.employee_id = u.id
            LEFT JOIN users u1 ON a.created_by = u1.id
            WHERE a.payroll_run_id = ?
        ";
        $params = [$runId];
        
        if ($employeeId) {
            $sql .= " AND a.employee_id = ?";
            $params[] = $employeeId;
        }
        
        return $this->db->fetchAll($sql . " ORDER BY a.created_at DESC", $params);
    }
    
    public function getStats(): array
    {
        $currentYear = date('Y');
        $currentMonth = date('m');
        
        // This month
        $thisMonth = $this->db->fetch("
            SELECT 
                COUNT(*) as run_count,
                SUM(total_gross) as total_gross,
                SUM(total_net) as total_net,
                SUM(total_deductions) as total_deductions
            FROM payroll_runs
            WHERE YEAR(period_start) = ? AND MONTH(period_start) = ?
            AND status = 'completed'
        ", [$currentYear, $currentMonth]);
        
        // YTD
        $ytd = $this->db->fetch("
            SELECT 
                COUNT(*) as run_count,
                SUM(total_gross) as total_gross,
                SUM(total_net) as total_net,
                SUM(total_deductions) as total_deductions
            FROM payroll_runs
            WHERE YEAR(period_start) = ? AND status = 'completed'
        ", [$currentYear]);
        
        // Pending payments
        $pending = $this->db->fetch("
            SELECT COUNT(*) as count, SUM(net_pay) as total
            FROM payroll_employees
            WHERE status = 'pending'
        ");
        
        // Paid this period
        $paid = $this->db->fetch("
            SELECT COUNT(*) as count, SUM(net_pay) as total
            FROM payroll_employees
            WHERE status = 'paid' AND paid_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ");
        
        return [
            'this_month' => [
                'runs' => (int)($thisMonth['run_count'] ?? 0),
                'gross' => (float)($thisMonth['total_gross'] ?? 0),
                'net' => (float)($thisMonth['total_net'] ?? 0),
                'deductions' => (float)($thisMonth['total_deductions'] ?? 0)
            ],
            'ytd' => [
                'runs' => (int)($ytd['run_count'] ?? 0),
                'gross' => (float)($ytd['total_gross'] ?? 0),
                'net' => (float)($ytd['total_net'] ?? 0),
                'deductions' => (float)($ytd['total_deductions'] ?? 0)
            ],
            'pending' => [
                'count' => (int)($pending['count'] ?? 0),
                'total' => (float)($pending['total'] ?? 0)
            ],
            'paid' => [
                'count' => (int)($paid['count'] ?? 0),
                'total' => (float)($paid['total'] ?? 0)
            ]
        ];
    }
    
    public function getPayrollHistory(int $employeeId, int $limit = 12): array
    {
        return $this->db->fetchAll("
            SELECT pe.*, p.name as payroll_name, p.period_start, p.period_end
            FROM payroll_employees pe
            JOIN payroll_runs p ON pe.payroll_run_id = p.id
            WHERE pe.employee_id = ?
            ORDER BY p.period_start DESC
            LIMIT ?
        ", [$employeeId, $limit]);
    }
    
    public function getVariances(int $runId): array
    {
        // Compare to previous payroll run
        $current = $this->findPayrollRun($runId);
        if (!$current) return [];
        
        // Find previous run
        $previous = $this->db->fetch("
            SELECT id FROM payroll_runs
            WHERE period_end < ? AND status = 'completed'
            ORDER BY period_end DESC
            LIMIT 1
        ", [$current['period_start']]);
        
        if (!$previous) return [];
        
        // Get variance analysis
        return $this->db->fetchAll("
            SELECT 
                c.employee_id,
                u.name as employee_name,
                c.base_salary as current_salary,
                p.base_salary as previous_salary,
                c.base_salary - p.base_salary as salary_change,
                ROUND(((c.base_salary - p.base_salary) / NULLIF(p.base_salary, 0)) * 100, 2) as salary_change_pct,
                c.net_pay as current_net,
                p.net_pay as previous_net,
                c.net_pay - p.net_pay as net_change
            FROM payroll_employees c
            JOIN payroll_employees p ON c.employee_id = p.employee_id
            JOIN users u ON c.employee_id = u.id
            WHERE c.payroll_run_id = ? AND p.payroll_run_id = ?
            HAVING ABS(salary_change_pct) > 10 OR ABS(net_change) > 100
            ORDER BY ABS(net_change) DESC
        ", [$runId, $previous['id']]);
    }
}
