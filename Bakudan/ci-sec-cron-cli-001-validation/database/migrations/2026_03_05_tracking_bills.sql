-- Tracking Bill tables
-- Run this in your MySQL database (phpMyAdmin / CLI)

CREATE TABLE IF NOT EXISTS stores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(255) NULL,
  color VARCHAR(20) NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  store_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  vendor VARCHAR(255) NULL,
  amount DECIMAL(12,2) NULL,
  due_date DATE NOT NULL,
  status ENUM('pending','paid','overdue') DEFAULT 'pending',
  note TEXT NULL,
  color VARCHAR(20) NULL,
  created_by INT NULL,
  reminded_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bills_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_bills_due ON bills(due_date);
CREATE INDEX idx_bills_store ON bills(store_id);
