-- =====================================================
-- QA: Reviewer & Approver Workspace Test Data
-- Run these queries during manual walkthrough
-- =====================================================

-- STEP 1: Verify Users exist for testing
SELECT id, name, role, email FROM users WHERE role IN ('admin', 'ceo', 'manager') LIMIT 5;

-- STEP 2: Create Test Task (run as logged-in user)
-- Note: Create task via UI, use this to verify it exists

-- STEP 3-10: Verify records created
-- Run after each step to verify data persistence

-- =====================================================
-- VERIFICATION QUERIES - Run after each workflow step
-- =====================================================

-- Check tasks table for our test task
-- Replace :task_id with actual task ID from UI
-- SELECT * FROM tasks WHERE id = :task_id;

-- Check task_comments table
-- SELECT * FROM task_comments WHERE task_id = :task_id;

-- Check task_notifications table
-- SELECT * FROM task_notifications WHERE task_id = :task_id ORDER BY created_at DESC;

-- Check task_reviewer_notes table
-- SELECT * FROM task_reviewer_notes WHERE task_id = :task_id;

-- Check task_approval_notes table
-- SELECT * FROM task_approval_notes WHERE task_id = :task_id;

-- Check attachments table
-- SELECT * FROM attachments WHERE task_id = :task_id;

-- =====================================================
-- COMPLETE VERIFICATION - Run at end of walkthrough
-- =====================================================

-- All tasks created today
SELECT id, title, status, reviewer_id, approver_id, 
       review_instructions, review_checklist, required_evidence, required_files,
       reviewer_result, approver_result, created_at
FROM tasks 
WHERE DATE(created_at) = CURDATE()
ORDER BY created_at DESC;

-- Recent task comments (includes @mentions)
SELECT tc.*, u.name as user_name 
FROM task_comments tc
JOIN users u ON tc.user_id = u.id
WHERE DATE(tc.created_at) = CURDATE()
ORDER BY tc.created_at DESC;

-- Recent notifications
SELECT tn.*, u.name as user_name
FROM task_notifications tn
JOIN users u ON tn.user_id = u.id
WHERE DATE(tn.created_at) = CURDATE()
ORDER BY tn.created_at DESC;

-- Recent reviewer notes
SELECT rn.*, u.name as reviewer_name
FROM task_reviewer_notes rn
JOIN users u ON rn.user_id = u.id
WHERE DATE(rn.created_at) = CURDATE()
ORDER BY rn.created_at DESC;

-- Recent approval notes
SELECT an.*, u.name as approver_name
FROM task_approval_notes an
JOIN users u ON an.user_id = u.id
WHERE DATE(an.created_at) = CURDATE()
ORDER BY an.created_at DESC;

-- Recent attachments
SELECT a.*, u.name as uploaded_by_name
FROM attachments a
JOIN users u ON a.uploaded_by = u.id
WHERE DATE(a.created_at) = CURDATE()
ORDER BY a.created_at DESC;

-- =====================================================
-- WORKFLOW STATUS CHECK
-- =====================================================

-- Tasks by approval status
SELECT 
    status,
    COUNT(*) as count,
    GROUP_CONCAT(id) as task_ids
FROM tasks 
WHERE DATE(created_at) = CURDATE()
GROUP BY status;

-- Reviewer decisions
SELECT 
    reviewer_result,
    COUNT(*) as count
FROM tasks 
WHERE DATE(created_at) = CURDATE() AND reviewer_result IS NOT NULL
GROUP BY reviewer_result;

-- Approver decisions  
SELECT 
    approver_result,
    COUNT(*) as count
FROM tasks 
WHERE DATE(created_at) = CURDATE() AND approver_result IS NOT NULL
GROUP BY approver_result;

-- =====================================================
-- ERROR CHECKING
-- =====================================================

-- Check for any errors in recent logs (if logs table exists)
-- SELECT * FROM error_logs WHERE DATE(created_at) = CURDATE() ORDER BY created_at DESC LIMIT 10;

-- Check database connection
SELECT 'Database connection OK' as status, NOW() as timestamp;
