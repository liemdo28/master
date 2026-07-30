-- Vendor & Bill Enhancement Migration
-- Run this in your MySQL database (phpMyAdmin / CLI)

-- Vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  payment_url VARCHAR(500) NULL,
  login_info TEXT NULL,
  notes TEXT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Vendor attachments (files, images)
CREATE TABLE IF NOT EXISTS vendor_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_size INT DEFAULT 0,
  mime_type VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_vendor_attachments_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bill attachments (PDF, images)
CREATE TABLE IF NOT EXISTS bill_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_size INT DEFAULT 0,
  mime_type VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bill_attachments_bill FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add vendor_id to bills (keep vendor text column for backward compat)
ALTER TABLE bills ADD COLUMN vendor_id INT NULL AFTER vendor;
ALTER TABLE bills ADD CONSTRAINT fk_bills_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
