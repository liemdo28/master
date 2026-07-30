<?php
/**
 * Section Model — Section normalization and validation
 * All section_id values must be validated through this model before saving to tasks.
 */
class Section {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    /**
     * Normalize and validate a section_id before saving to tasks.
     * Returns a safe section_id (int or null) that will never violate FK constraints.
     *
     * Rules:
     *   - empty / null / '' / '0'       → null
     *   - non-numeric                          → null
     *   - section does not exist              → null
     *   - section belongs to different project → null
     *   - valid                               → (int) section_id
     */
    public function normalizeSectionId($sectionId, ?int $projectId = null): ?int {
        // Null, empty string, '0', or 0 all mean "no column" → null
        if ($sectionId === null || $sectionId === '' || $sectionId === '0' || $sectionId === 0) {
            return null;
        }

        // Must be numeric
        if (!is_numeric($sectionId)) {
            return null;
        }

        $id = (int) $sectionId;
        if ($id <= 0) {
            return null;
        }

        // Check section exists
        $section = $this->db->fetch(
            "SELECT id, project_id FROM sections WHERE id = ? LIMIT 1",
            [$id]
        );

        if (!$section) {
            return null;
        }

        // If project_id is provided, verify section belongs to this project
        if ($projectId !== null && (int)$section['project_id'] !== $projectId) {
            return null;
        }

        return $id;
    }

    /**
     * Get the default/first section for a project.
     * Used when a task must have a section but none was provided.
     */
    public function getDefaultForProject(int $projectId): ?int {
        $row = $this->db->fetch(
            "SELECT id FROM sections WHERE project_id = ? ORDER BY position ASC LIMIT 1",
            [$projectId]
        );
        return $row ? (int)$row['id'] : null;
    }

    /**
     * Get all sections for a project, ordered by position.
     */
    public function getForProject(int $projectId): array {
        return $this->db->fetchAll(
            "SELECT id, name, position FROM sections WHERE project_id = ? ORDER BY position ASC",
            [$projectId]
        );
    }

    /**
     * Ensure every project has at least one section.
     * Creates a "To Do" section if missing.
     * Returns [project_id => section_id] map of defaults created.
     */
    public function ensureDefaultSections(): array {
        $projects = $this->db->fetchAll(
            "SELECT p.id FROM projects p WHERE NOT EXISTS (
                SELECT 1 FROM sections s WHERE s.project_id = p.id
            )"
        );

        $created = [];
        foreach ($projects as $p) {
            $pid = (int)$p['id'];
            $this->db->insert(
                "INSERT INTO sections (project_id, name, position) VALUES (?, 'To Do', 0)",
                [$pid]
            );
            $created[$pid] = $this->db->lastInsertId();
        }
        return $created;
    }

    /**
     * Repair orphaned tasks.section_id values.
     * Tasks referencing non-existent sections get section_id = NULL.
     */
    public function repairOrphanedTasks(): int {
        $result = $this->db->update(
            "UPDATE tasks t
             LEFT JOIN sections s ON s.id = t.section_id
             SET t.section_id = NULL
             WHERE t.section_id IS NOT NULL AND s.id IS NULL"
        );
        return $result;
    }
}
