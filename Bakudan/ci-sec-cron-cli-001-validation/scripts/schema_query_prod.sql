-- Production schema check
-- Tables
SELECT table_name FROM information_schema.tables WHERE table_schema='taskflow_db' ORDER BY table_name;

-- tasks columns
SELECT column_name FROM information_schema.columns WHERE table_schema='taskflow_db' AND table_name='tasks' ORDER BY ordinal_position;

-- notifications columns
SELECT column_name FROM information_schema.columns WHERE table_schema='taskflow_db' AND table_name='notifications' ORDER BY ordinal_position;

-- task_notifications columns
SELECT column_name FROM information_schema.columns WHERE table_schema='taskflow_db' AND table_name='task_notifications' ORDER BY ordinal_position;

-- releases columns
SELECT column_name FROM information_schema.columns WHERE table_schema='taskflow_db' AND table_name='releases' ORDER BY ordinal_position;

-- Connection test
SELECT 'PRODUCTION_CONN_OK' AS status, DATABASE() AS db, VERSION() AS mysql_version;
