-- ============================================================
-- TaskFlow v7 — Telegram Bot Integration
-- Run AFTER schema.sql + schema_v2/v3/v4/v5/v6.sql
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. TELEGRAM_LINK
--    One row per user who has linked their Telegram account.
--    telegram_chat_id is stable (unlike username).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telegram_link (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT        NOT NULL,
    telegram_chat_id    BIGINT     NOT NULL,
    telegram_username   VARCHAR(100) NULL DEFAULT NULL,
    telegram_first_name VARCHAR(100) NULL DEFAULT NULL,
    linked_at           TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active           TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY uq_tg_user   (user_id),
    UNIQUE KEY uq_tg_chat   (telegram_chat_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- 2. TELEGRAM_LINK_TOKEN
--    Short-lived OTP tokens for deep-link account linking.
--    UUID primary key; expires in 15 minutes; one-time use.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telegram_link_token (
    token       CHAR(36)  NOT NULL PRIMARY KEY,
    user_id     INT       NOT NULL,
    expires_at  TIMESTAMP NOT NULL,
    consumed_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_tg_token_user    ON telegram_link_token(user_id);
CREATE INDEX IF NOT EXISTS idx_tg_token_expires ON telegram_link_token(expires_at);

-- ─────────────────────────────────────────────────────────────
-- 3. TELEGRAM_PREFERENCES
--    Per-user notification preferences. Created on first link.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telegram_preferences (
    user_id                INT       NOT NULL PRIMARY KEY,
    daily_summary_enabled  TINYINT(1) NOT NULL DEFAULT 1,
    daily_summary_time     TIME      NOT NULL DEFAULT '08:00:00',
    notify_on_assign       TINYINT(1) NOT NULL DEFAULT 1,
    notify_on_mention      TINYINT(1) NOT NULL DEFAULT 1,
    notify_on_task_update  TINYINT(1) NOT NULL DEFAULT 0,
    notify_on_deadline     TINYINT(1) NOT NULL DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
-- 4. TELEGRAM_MESSAGE_LOG
--    Audit trail for all inbound/outbound bot messages.
--    draft_key / consumed_at support the F2 task-confirmation flow.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telegram_message_log (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT    NULL DEFAULT NULL,
    chat_id      BIGINT NOT NULL,
    direction    ENUM('in','out') NOT NULL,
    message_type ENUM('summary','create_task','notify','qa','pending_task','other') NOT NULL DEFAULT 'other',
    content      TEXT   NULL,
    draft_key    VARCHAR(32) NULL DEFAULT NULL,
    consumed_at  TIMESTAMP   NULL DEFAULT NULL,
    ai_provider  VARCHAR(30) NULL DEFAULT NULL,
    ai_tokens_used INT       NULL DEFAULT 0,
    created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_tg_log_user    (user_id),
    KEY idx_tg_log_chat    (chat_id),
    KEY idx_tg_log_type    (message_type),
    KEY idx_tg_log_draft   (draft_key),
    KEY idx_tg_log_created (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
