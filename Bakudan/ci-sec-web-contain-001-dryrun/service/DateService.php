<?php
/**
 * DateService — single source of truth for dates/timezones.
 *
 * Rules:
 *  - All DB datetime columns are stored in UTC (or server-local until migrated — see toUtc()).
 *  - User-facing strings are always rendered in the resolved TZ.
 *  - NEVER use date()/strtotime()/mktime() outside this service.
 */
class DateService
{
    /** Workspace default timezone (fallback chain: task → user → workspace → system). */
    const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';

    /** Resolve the TZ to use for a given user. */
    public static function resolveTimezone(?int $userId = null): string
    {
        // 1. Per-user (if provided and column exists)
        if ($userId) {
            try {
                $db = Database::getInstance();
                if ($db->columnExists('users', 'timezone')) {
                    $row = $db->fetch("SELECT timezone FROM users WHERE id = ?", [$userId]);
                    if (!empty($row['timezone'])) return $row['timezone'];
                }
            } catch (Exception $e) { /* fall through */ }
        }
        // 2. Workspace default
        if (defined('APP_TIMEZONE') && APP_TIMEZONE) return APP_TIMEZONE;
        // 3. System
        return self::DEFAULT_TZ;
    }

    private static function tz(?string $tz): DateTimeZone
    {
        return new DateTimeZone($tz ?: self::resolveTimezone());
    }

    /** Today as Y-m-d in the resolved TZ. */
    public static function today(?string $tz = null): string
    {
        return (new DateTimeImmutable('now', self::tz($tz)))->format('Y-m-d');
    }

    /** Now as DateTimeImmutable in the resolved TZ. */
    public static function now(?string $tz = null): DateTimeImmutable
    {
        return new DateTimeImmutable('now', self::tz($tz));
    }

    /** Convert a local datetime string to UTC Y-m-d H:i:s. */
    public static function toUtc(string $localDt, ?string $tz = null): string
    {
        $dt = new DateTimeImmutable($localDt, self::tz($tz));
        return $dt->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }

    /** Convert a UTC datetime string to the given TZ Y-m-d H:i:s. */
    public static function fromUtc(string $utcDt, ?string $tz = null): string
    {
        $dt = new DateTimeImmutable($utcDt, new DateTimeZone('UTC'));
        return $dt->setTimezone(self::tz($tz))->format('Y-m-d H:i:s');
    }

    /**
     * Return [startUtc, endUtc] for the given month in the given TZ.
     * End is exclusive (first second of next month) to make range queries safe.
     */
    public static function monthBounds(int $year, int $month, ?string $tz = null): array
    {
        $z = self::tz($tz);
        $start = new DateTimeImmutable(sprintf('%04d-%02d-01 00:00:00', $year, $month), $z);
        $end = $start->modify('+1 month');
        $u = new DateTimeZone('UTC');
        return [
            $start->setTimezone($u)->format('Y-m-d H:i:s'),
            $end->setTimezone($u)->format('Y-m-d H:i:s'),
        ];
    }

    /** Whole-day difference between two Y-m-d strings in the given TZ (b - a). */
    public static function diffDays(string $a, string $b, ?string $tz = null): int
    {
        $z = self::tz($tz);
        $da = new DateTimeImmutable($a, $z);
        $db = new DateTimeImmutable($b, $z);
        $diff = $da->diff($db);
        return ($diff->invert ? -1 : 1) * (int)$diff->days;
    }

    /** True if the given Y-m-d is before today (overdue). */
    public static function isOverdue(?string $dueDate, ?string $tz = null): bool
    {
        if (!$dueDate) return false;
        return self::diffDays(self::today($tz), substr($dueDate, 0, 10), $tz) < 0;
    }

    /** True if the given Y-m-d is today. */
    public static function isToday(?string $dueDate, ?string $tz = null): bool
    {
        if (!$dueDate) return false;
        return substr($dueDate, 0, 10) === self::today($tz);
    }

    /** Add N days to a Y-m-d string (TZ-safe). */
    public static function addDays(string $date, int $days, ?string $tz = null): string
    {
        $dt = new DateTimeImmutable($date, self::tz($tz));
        return $dt->modify(($days >= 0 ? '+' : '') . $days . ' days')->format('Y-m-d');
    }

    /**
     * Clamp a target (year, month, day) so that day is valid for that month.
     * Used by monthly recurrence on Jan 31 → Feb 28/29.
     */
    public static function clampToMonth(int $year, int $month, int $day, ?string $tz = null): string
    {
        $z = self::tz($tz);
        $first = new DateTimeImmutable(sprintf('%04d-%02d-01', $year, $month), $z);
        $lastDay = (int)$first->format('t');
        $day = min($day, $lastDay);
        return sprintf('%04d-%02d-%02d', $year, $month, $day);
    }
}
