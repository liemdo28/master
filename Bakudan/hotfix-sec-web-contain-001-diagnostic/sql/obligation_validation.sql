-- Obligation system validation
SHOW TABLES LIKE 'obligation_categories';
SHOW TABLES LIKE 'obligations';
SHOW TABLES LIKE 'obligation_payments';

SELECT COUNT(*) AS categories_count FROM obligation_categories;
SELECT COUNT(*) AS obligations_count FROM obligations;
SELECT COUNT(*) AS payments_count FROM obligation_payments;

SELECT obligation_id, due_date, COUNT(*) AS dup_count
FROM obligation_payments
GROUP BY obligation_id, due_date
HAVING COUNT(*) > 1;

SELECT op.id, op.obligation_id, op.task_id, op.due_date
FROM obligation_payments op
LEFT JOIN tasks t ON t.id = op.task_id
WHERE op.task_id IS NOT NULL AND t.id IS NULL;

SELECT COUNT(*) AS overdue_unpaid
FROM obligation_payments
WHERE due_date < CURDATE() AND status NOT IN ('paid','skipped','approved');

SELECT status, COUNT(*) AS c
FROM obligation_payments
GROUP BY status
ORDER BY c DESC;

SELECT o.name, o.frequency, o.next_due_date, o.active
FROM obligations o
ORDER BY o.next_due_date ASC, o.name ASC;
