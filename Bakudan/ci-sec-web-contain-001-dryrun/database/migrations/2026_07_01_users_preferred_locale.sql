ALTER TABLE users
    ADD COLUMN preferred_locale VARCHAR(10) NOT NULL DEFAULT 'en-US' AFTER role;
