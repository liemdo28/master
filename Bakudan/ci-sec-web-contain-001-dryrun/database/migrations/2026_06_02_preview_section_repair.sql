-- ============================================================
-- Preview Section Repair — PREVIEW ONLY
-- Fix orphaned tasks.section_id and ensure every project has a default section.
-- ============================================================

-- 1. Inspect orphaned tasks before repair
SELECT t.id, t.title, t.section_id
FROM tasks t
LEFT JOIN sections s ON s.id = t.section_id
WHERE t.section_id IS NOT NULL
  AND s.id IS NULL;

-- 2. Repair orphaned section references
UPDATE tasks t
LEFT JOIN sections s ON s.id = t.section_id
SET t.section_id = NULL
WHERE t.section_id IS NOT NULL
  AND s.id IS NULL;

-- 3. Create default 'To Do' section for projects with no sections
INSERT INTO sections (project_id, name, position)
SELECT p.id, 'To Do', 0
FROM projects p
LEFT JOIN sections s ON s.project_id = p.id
WHERE s.id IS NULL;

-- 4. Inspect all sections after repair
SELECT id, project_id, name, position
FROM sections
ORDER BY project_id, position;

SELECT 'Preview section repair completed' AS status;
