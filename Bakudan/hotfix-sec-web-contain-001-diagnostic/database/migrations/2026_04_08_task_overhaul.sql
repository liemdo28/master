-- TaskFlow v2 - Task Management Overhaul
-- Run: April 2026

-- 1. Complete all old tasks (before April 2026)
UPDATE tasks SET is_completed = 1, completed_at = NOW(), status = 'done'
WHERE is_completed = 0 AND created_at < '2026-04-01';

-- 2. Add manager role to users
ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'manager', 'member') DEFAULT 'member';

-- 3. Task acceptance, reschedule columns (handled by Task model auto-migration)
-- accepted_at, parent_task_id, reschedule_count are added dynamically

-- 4. Create stores
INSERT IGNORE INTO stores (name, address, color, is_active, created_at) VALUES
('Raw', NULL, '#6366f1', 1, NOW()),
('Bakudan - The Rim (B1)', NULL, '#dc2626', 1, NOW()),
('Bakudan - Stone Oak (B2)', NULL, '#f59e0b', 1, NOW()),
('Bakudan - Bandera (B3)', NULL, '#22c55e', 1, NOW()),
('IFT', NULL, '#3b82f6', 1, NOW()),
('HEO', NULL, '#a855f7', 1, NOW()),
('Copper (C1, C2, C3)', NULL, '#f97316', 1, NOW());

-- 5. Rename "Liem/ Hoang / Anh" project to "Finance"
UPDATE projects SET name = 'Finance' WHERE name LIKE 'Liem%Hoang%Anh%' OR name LIKE 'Liem/%Hoang%';

-- 6. Create "Others" project (if not exists) - owner should be admin user ID 1
-- This will be done via PHP to get proper owner_id
