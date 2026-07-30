-- Phase 11 Demo Seed Data
-- Generated: 2026-05-29

-- Demo Employees (linked to existing users if any)
INSERT IGNORE INTO employees (user_id, store_id, employee_code, position, department, hire_date, status, hourly_rate)
SELECT id, store_id, CONCAT('EMP-', LPAD(id, 4, '0')), 
       CASE role WHEN 'admin' THEN 'General Manager' WHEN 'manager' THEN 'Store Manager' ELSE 'Team Member' END,
       'Operations', DATE_SUB(CURDATE(), INTERVAL FLOOR(RAND()*365*2) DAY), 'active',
       CASE role WHEN 'admin' THEN 35.00 WHEN 'manager' THEN 25.00 ELSE 18.00 END
FROM users WHERE is_active = 1 LIMIT 10;

-- Demo Shifts (next 7 days)
INSERT IGNORE INTO shifts (store_id, user_id, shift_date, start_time, end_time, role, status)
SELECT s.id, u.id, DATE_ADD(CURDATE(), INTERVAL seq.n DAY),
       CASE WHEN seq.n % 2 = 0 THEN '09:00' ELSE '14:00' END,
       CASE WHEN seq.n % 2 = 0 THEN '17:00' ELSE '22:00' END,
       CASE WHEN u.role = 'manager' THEN 'Manager' ELSE 'Staff' END,
       'scheduled'
FROM stores s
CROSS JOIN users u
CROSS JOIN (SELECT 0 AS n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) seq
WHERE u.is_active = 1 AND u.store_id = s.id
LIMIT 30;

-- Demo Training Modules
INSERT IGNORE INTO training_modules (title, description, category, duration_hours, difficulty, status, created_by) VALUES
('Food Safety Basics', 'Essential food handling and safety procedures', 'Food Safety', 2.0, 'beginner', 'published', 1),
('Customer Service Excellence', 'How to deliver outstanding customer experiences', 'Customer Service', 1.5, 'beginner', 'published', 1),
('Cash Register Operations', 'POS system training and cash handling', 'Operations', 1.0, 'beginner', 'published', 1),
('Kitchen Equipment Safety', 'Safe operation of all kitchen equipment', 'Safety', 2.5, 'intermediate', 'published', 1),
('Manager Leadership', 'Leadership skills for store managers', 'Management', 4.0, 'advanced', 'published', 1),
('Inventory Management', 'Stock counting, ordering, and waste reduction', 'Operations', 2.0, 'intermediate', 'published', 1),
('Emergency Procedures', 'Fire, earthquake, and medical emergency protocols', 'Safety', 1.5, 'beginner', 'published', 1),
('Ramen Preparation Standards', 'Quality standards for all ramen dishes', 'Food Prep', 3.0, 'intermediate', 'draft', 1);

-- Demo Procurements
INSERT IGNORE INTO procurements (store_id, title, category, vendor, status, requested_by, total_amount, notes) VALUES
((SELECT id FROM stores LIMIT 1), 'Monthly Noodle Supply', 'Food', 'Sun Noodle', 'approved', 1, 2500.00, 'Regular monthly order'),
((SELECT id FROM stores LIMIT 1), 'Kitchen Equipment Repair', 'Maintenance', 'Restaurant Depot', 'pending', 1, 850.00, 'Fryer thermostat replacement'),
((SELECT id FROM stores LIMIT 1), 'Cleaning Supplies Q2', 'Supplies', 'Costco Business', 'received', 1, 420.00, 'Quarterly cleaning supply order'),
((SELECT id FROM stores LIMIT 1 OFFSET 1), 'New POS Terminal', 'Equipment', 'Square', 'draft', 1, 1200.00, 'Replacement for broken terminal');

-- Demo Documents
INSERT IGNORE INTO documents (title, category, store_id, uploaded_by, file_type, description, status) VALUES
('Employee Handbook 2026', 'HR', NULL, 1, 'application/pdf', 'Company-wide employee handbook', 'active'),
('Food Safety Manual', 'Compliance', NULL, 1, 'application/pdf', 'HACCP and food safety procedures', 'active'),
('Store Opening Checklist Template', 'Operations', NULL, 1, 'application/pdf', 'Standard opening procedure', 'active'),
('Emergency Contact List', 'Safety', NULL, 1, 'application/pdf', 'All emergency contacts by store', 'active'),
('Menu Pricing Sheet Q2 2026', 'Finance', NULL, 1, 'application/vnd.ms-excel', 'Current menu pricing', 'active');

-- Demo Calendar Events
INSERT IGNORE INTO calendar_events (title, event_type, start_date, end_date, color, created_by) VALUES
('Independence Day', 'holiday', '2026-07-04', '2026-07-04', '#ef4444', 1),
('Labor Day', 'holiday', '2026-09-07', '2026-09-07', '#ef4444', 1),
('Q3 Planning Meeting', 'meeting', '2026-07-01', '2026-07-01', '#3b82f6', 1),
('Health Inspection - Stockton', 'deadline', '2026-06-15', '2026-06-15', '#f59e0b', 1),
('Staff Training Day', 'training', '2026-06-10', '2026-06-10', '#8b5cf6', 1),
('Menu Launch - Summer Special', 'other', '2026-06-20', '2026-06-20', '#10b981', 1);

-- Demo Incident Playbooks
INSERT IGNORE INTO incident_playbooks (name, category, severity, description, steps, estimated_time, created_by) VALUES
('Power Outage Response', 'Infrastructure', 'high', 'Steps to follow during a power outage',
 '["Check circuit breakers","Contact power company","Secure perishable food","Notify customers","Document incident"]', 30, 1),
('Customer Complaint Escalation', 'Customer Service', 'medium', 'How to handle escalated customer complaints',
 '["Listen actively","Apologize sincerely","Offer resolution","Document complaint","Follow up within 24h"]', 15, 1),
('Food Safety Violation', 'Compliance', 'critical', 'Immediate response to food safety issues',
 '["Stop serving affected items","Isolate contaminated food","Check temperatures","Document everything","Contact health dept if required","Retrain staff"]', 60, 1),
('Employee Injury', 'Safety', 'high', 'Response to workplace injury',
 '["Provide first aid","Call 911 if serious","Document incident","File workers comp","Review safety procedures"]', 45, 1);
