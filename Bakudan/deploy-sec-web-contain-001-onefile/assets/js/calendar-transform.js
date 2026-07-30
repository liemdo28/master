/**
 * CalendarTransform — Safe task-to-calendar-event transformation layer.
 *
 * Single source of truth for converting raw task objects into renderable
 * calendar events. Prevents crashes from:
 *   - null/undefined task fields
 *   - invalid dates
 *   - missing project metadata
 *   - malformed recurrence data
 *
 * Usage:
 *   const events = CalendarTransform.fromTasks(rawTasks);
 *   const event = CalendarTransform.transformTask(task);
 *   const valid = CalendarTransform.isRenderable(event);
 */
(function () {
    'use strict';

    const PRIORITY_COLORS = {
        urgent: '#dc2626',
        high: '#f59e0b',
        medium: '#3b82f6',
        low: '#71717a'
    };

    const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };

    /**
     * Transform a raw task object into a safe calendar event.
     * Returns null if the task is not renderable (no valid date).
     *
     * @param {object} task - Raw task from API
     * @returns {object|null} Calendar event or null
     */
    function transformTask(task) {
        if (!task || typeof task !== 'object') return null;

        // Must have a valid due_date to appear on calendar
        const dueDate = SafeDate.safeISODate(task.due_date);
        if (!dueDate) return null;

        const id = parseInt(task.id, 10);
        if (!id || isNaN(id)) return null;

        const today = window.APP_TODAY || SafeDate.safeISODate(new Date());
        const isCompleted = !!(task.is_completed && task.is_completed !== '0');
        const isOverdue = !isCompleted && dueDate < today;
        const isToday = dueDate === today;
        const isSoon = !isCompleted && !isOverdue && !isToday && SafeDate.safeDateDiff(today, dueDate) <= 2 && SafeDate.safeDateDiff(today, dueDate) > 0;

        // Determine urgency class
        let urgency = 'normal';
        if (isCompleted) urgency = 'completed';
        else if (isOverdue) urgency = 'overdue';
        else if (isToday) urgency = 'today';
        else if (isSoon) urgency = 'soon';

        // Safe color extraction
        const projectColor = safeColor(task.project_color) || safeColor(task.color);
        const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
        const displayColor = urgency === 'normal' ? (projectColor || priorityColor) : null;

        return {
            id: id,
            title: safeString(task.title, 'Untitled'),
            dueDate: dueDate,
            startDate: SafeDate.safeISODate(task.start_date) || null,
            priority: safePriority(task.priority),
            priorityOrder: PRIORITY_ORDER[task.priority] ?? 2,
            status: safeString(task.status, 'todo'),
            isCompleted: isCompleted,
            urgency: urgency,

            // Display
            displayColor: displayColor,
            textColor: displayColor ? computeTextColor(displayColor) : null,

            // Metadata
            projectId: safeInt(task.project_id),
            projectName: safeString(task.project_name, ''),
            storeName: safeString(task.store_name, ''),
            storeColor: safeColor(task.store_color),
            assigneeName: safeString(task.assignee_name, ''),
            creatorName: safeString(task.creator_name, ''),

            // Recurrence
            isRecurring: (task.repeat_type && task.repeat_type !== 'none') || false,
            repeatType: task.repeat_type || 'none',
            recurringRootId: safeInt(task.recurring_root_id),

            // Links
            href: '/tasks/' + id,

            // Raw reference (for edge cases)
            _raw: task
        };
    }

    /**
     * Transform an array of tasks into calendar events.
     * Silently skips invalid tasks (logs warning).
     *
     * @param {Array} tasks - Array of raw task objects
     * @returns {Array} Array of valid calendar events
     */
    function fromTasks(tasks) {
        if (!Array.isArray(tasks)) {
            console.warn('[CalendarTransform] Expected array, got:', typeof tasks);
            return [];
        }

        const events = [];
        for (let i = 0; i < tasks.length; i++) {
            try {
                const event = transformTask(tasks[i]);
                if (event) {
                    events.push(event);
                } else if (tasks[i]?.id) {
                    console.debug('[CalendarTransform] Skipped task (no valid date):', tasks[i].id);
                }
            } catch (err) {
                console.warn('[CalendarTransform] Failed to transform task at index', i, err);
                if (window.TaskFlowRuntime?.logClientError) {
                    window.TaskFlowRuntime.logClientError('calendar.transform', err, {
                        taskId: tasks[i]?.id,
                        index: i
                    });
                }
            }
        }

        return events;
    }

    /**
     * Check if a calendar event is safe to render.
     * @param {object} event - Transformed calendar event
     * @returns {boolean}
     */
    function isRenderable(event) {
        return event !== null
            && typeof event === 'object'
            && typeof event.id === 'number'
            && typeof event.dueDate === 'string'
            && event.dueDate.length === 10;
    }

    /**
     * Group events by date for calendar grid rendering.
     * @param {Array} events - Array of transformed events
     * @returns {Object} Map of 'YYYY-MM-DD' → [events]
     */
    function groupByDate(events) {
        const grouped = {};
        for (const event of events) {
            if (!event?.dueDate) continue;
            if (!grouped[event.dueDate]) grouped[event.dueDate] = [];
            grouped[event.dueDate].push(event);
        }

        // Sort each day's events by priority then title
        for (const date in grouped) {
            grouped[date].sort((a, b) => {
                if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
                if (a.priorityOrder !== b.priorityOrder) return a.priorityOrder - b.priorityOrder;
                return a.title.localeCompare(b.title);
            });
        }

        return grouped;
    }

    /**
     * Get summary stats for a set of events (useful for dashboard widgets).
     * @param {Array} events
     * @returns {object}
     */
    function getStats(events) {
        let total = 0, completed = 0, overdue = 0, today = 0, recurring = 0;
        for (const e of events) {
            total++;
            if (e.isCompleted) completed++;
            if (e.urgency === 'overdue') overdue++;
            if (e.urgency === 'today') today++;
            if (e.isRecurring) recurring++;
        }
        return { total, completed, overdue, today, recurring };
    }

    // ── Internal helpers ─────────────────────────────────────────────────

    function safeString(val, fallback) {
        if (val === null || val === undefined) return fallback;
        return String(val).trim() || fallback;
    }

    function safeInt(val) {
        if (val === null || val === undefined) return null;
        const n = parseInt(val, 10);
        return isNaN(n) ? null : n;
    }

    function safePriority(val) {
        const allowed = ['urgent', 'high', 'medium', 'low'];
        return allowed.includes(val) ? val : 'medium';
    }

    function safeColor(val) {
        if (!val || typeof val !== 'string') return null;
        const trimmed = val.trim();
        // Accept #hex or hex
        if (/^#?[0-9a-fA-F]{3,6}$/.test(trimmed)) {
            return trimmed.startsWith('#') ? trimmed : '#' + trimmed;
        }
        return null;
    }

    function computeTextColor(hex) {
        if (!hex) return '#f8fafc';
        const clean = hex.replace('#', '');
        if (clean.length < 6) return '#f8fafc';
        const r = parseInt(clean.substr(0, 2), 16);
        const g = parseInt(clean.substr(2, 2), 16);
        const b = parseInt(clean.substr(4, 2), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.68 ? '#050816' : '#f8fafc';
    }

    // Export
    window.CalendarTransform = Object.freeze({
        transformTask,
        fromTasks,
        isRenderable,
        groupByDate,
        getStats
    });
})();
