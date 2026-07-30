/**
 * SafeDate — shared date utility for TaskFlow dashboard.
 * Guarantees no Invalid Date leaks into the UI.
 *
 * Usage:
 *   const d = SafeDate.safeDate('2026-04-14');   // Date | null
 *   const s = SafeDate.safeFormatDate(val);      // "April 14, 2026" | '—'
 *   const iso = SafeDate.safeISODate(val);       // "2026-04-14" | null
 *   const ok = SafeDate.isValidDate(val);        // boolean
 *   const diff = SafeDate.safeDateDiff(a, b);    // number of days | null
 */
(function () {
    'use strict';

    /**
     * Parse a value into a valid Date object, or return null.
     * Accepts: Date instance, ISO string, 'YYYY-MM-DD', epoch number.
     * Never returns an Invalid Date.
     * @param {*} value
     * @returns {Date|null}
     */
    function safeDate(value) {
        if (value == null || value === '') return null;

        // Already a Date instance
        if (value instanceof Date) {
            return isNaN(value.getTime()) ? null : value;
        }

        // Numeric timestamp
        if (typeof value === 'number' && isFinite(value)) {
            const d = new Date(value);
            return isNaN(d.getTime()) ? null : d;
        }

        // String parsing
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return null;

            // Try native parse (handles ISO 8601 and common formats)
            const d = new Date(trimmed);
            if (!isNaN(d.getTime())) return d;

            // Fallback: try 'YYYY-MM-DD' manual parse to avoid timezone issues
            const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (match) {
                const [, y, m, day] = match.map(Number);
                const dt = new Date(y, m - 1, day);
                // Verify the date didn't roll over (e.g. Feb 30 → Mar 2)
                if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === day) {
                    return dt;
                }
            }

            return null;
        }

        return null;
    }

    /**
     * Format a date value for display, or return '—' on failure.
     * @param {*} value - anything safeDate() accepts
     * @param {string} [locale] - BCP 47 locale (default: undefined = browser default)
     * @param {Intl.DateTimeFormatOptions} [options] - formatting options
     * @returns {string}
     */
    function safeFormatDate(value, locale, options) {
        const d = safeDate(value);
        if (!d) return '\u2014'; // em-dash

        const defaultOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        try {
            return d.toLocaleDateString(locale, options || defaultOptions);
        } catch (e) {
            // Fallback if Intl fails (very unlikely in modern browsers)
            return d.toISOString().slice(0, 10);
        }
    }

    /**
     * Return an ISO date string 'YYYY-MM-DD' or null.
     * @param {*} value
     * @returns {string|null}
     */
    function safeISODate(value) {
        const d = safeDate(value);
        if (!d) return null;

        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    /**
     * Check whether a value can be parsed into a valid date.
     * @param {*} value
     * @returns {boolean}
     */
    function isValidDate(value) {
        return safeDate(value) !== null;
    }

    /**
     * Calculate the difference in whole days between two date values.
     * Returns a positive number if date2 > date1, negative otherwise.
     * Returns null if either date is invalid.
     * @param {*} date1
     * @param {*} date2
     * @returns {number|null}
     */
    function safeDateDiff(date1, date2) {
        const d1 = safeDate(date1);
        const d2 = safeDate(date2);
        if (!d1 || !d2) return null;

        const MS_PER_DAY = 86400000;
        // Normalize to midnight to avoid DST edge cases
        const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
        const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
        return Math.round((utc2 - utc1) / MS_PER_DAY);
    }

    // Export as window.SafeDate
    window.SafeDate = Object.freeze({
        safeDate: safeDate,
        safeFormatDate: safeFormatDate,
        safeISODate: safeISODate,
        isValidDate: isValidDate,
        safeDateDiff: safeDateDiff
    });
})();
