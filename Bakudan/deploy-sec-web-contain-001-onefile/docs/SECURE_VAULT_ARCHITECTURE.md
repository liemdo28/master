# Secure Vault Architecture
**Phase 11.9 — CEO Requirement**
**Date:** 2026-05-30

---

## Purpose

Store sensitive business credentials with encryption, audit logging, and permission-based access.

---

## Data Types

- Credit Card Info
- Banking References
- Vendor Accounts
- Tax Accounts (EIN, State IDs)
- Insurance Policies
- Lease Agreements

---

## Security Requirements

| Requirement | Implementation |
|-------------|---------------|
| Encrypted at rest | AES-256-GCM via PHP `openssl_encrypt` |
| Audit log | Every view/download logged with user, timestamp, IP |
| Permission-based | Role + explicit grant per vault item |
| View tracking | `vault_access_log` table |
| Download tracking | Separate log entry for file downloads |
| Session timeout | Auto-lock after 5 min inactivity |

---

## Schema

```sql
CREATE TABLE vault_items (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    store_id      INT UNSIGNED DEFAULT NULL,
    category      ENUM('credit_card','banking','vendor','tax','insurance','lease','other'),
    title         VARCHAR(255) NOT NULL,
    encrypted_data BLOB NOT NULL,
    encryption_iv  VARCHAR(64) NOT NULL,
    created_by    INT UNSIGNED NOT NULL,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_vault_store (store_id),
    INDEX idx_vault_category (category)
);

CREATE TABLE vault_access_log (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vault_id   INT UNSIGNED NOT NULL,
    user_id    INT UNSIGNED NOT NULL,
    action     ENUM('view','download','create','update','delete'),
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_val_vault (vault_id),
    INDEX idx_val_user (user_id)
);

CREATE TABLE vault_permissions (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    vault_id   INT UNSIGNED NOT NULL,
    user_id    INT UNSIGNED DEFAULT NULL,
    role       VARCHAR(50) DEFAULT NULL,
    can_view   TINYINT(1) DEFAULT 0,
    can_edit   TINYINT(1) DEFAULT 0,
    UNIQUE KEY uk_vault_user (vault_id, user_id)
);
```

---

## Implementation Priority

Phase 12 module. Requires dedicated security review before deployment.
