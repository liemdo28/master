-- Migration: Add 'ceo' role, keep 'member' as base role
-- Run this once on existing databases.

-- Widen ENUM to include ceo, keep member as default
ALTER TABLE users MODIFY COLUMN role ENUM('ceo','admin','manager','member') NOT NULL DEFAULT 'member';

-- Rename any 'staff' rows back to 'member' (if previous migration ran)
UPDATE users SET role = 'member' WHERE role = 'staff';
