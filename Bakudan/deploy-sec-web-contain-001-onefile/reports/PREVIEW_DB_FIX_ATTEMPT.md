# Preview DB Fix Attempt

Date: 2026-06-02

## Result

Preview was initially blocked at HTTP 503:

```text
https://preview.dashboard.bakudanramen.com/
Service Unavailable
Database connection failed
```

## Actions Completed

- Removed sidebar search from the app and deployed to DreamHost.
- Confirmed production assets no longer contain sidebar search code.
- Used GitHub Actions SSH to access the DreamHost account because direct local SSH failed.
- Found preview app folder:

```text
~/phase11-preview
```

- Patched preview DB host:

```text
DB_HOST=preview-db
```

to:

```text
DB_HOST=mysql-taskflow.bakudanramen.com
```

## DB Diagnostics

Preview env is correctly targeting the preview DB:

```text
DB_NAME=bakudan_preview
uses_preview_db=true
uses_production_db=false
```

Current preview DB user fails authentication:

```text
SQLSTATE[HY000] [1045] Access denied for user 'bakudan'
```

Existing production DB user was also tested against `bakudan_preview`; it authenticates but lacks privilege:

```text
SQLSTATE[HY000] [1044] Access denied for user 'liemdo' to database 'bakudan_preview'
```

All `.env.preview` files found on the server were tested. None contains a credential that can connect to `bakudan_preview`.

## Additional Credential Attempt

The provided credential was applied as a temporary GitHub secret and tested without printing the password.

Tested target:

```text
DB_HOST=mysql-taskflow.bakudanramen.com
DB_PORT=3306
DB_NAME=bakudan_preview
```

Tested users with that password:

```text
bakudan
bakudan_preview
liemdo
liemdo0208
taskflow_db
```

Result:

```text
All candidates failed with SQLSTATE[HY000] [1045] Access denied.
```

No local MySQL credential file was found on the DreamHost account that could connect to `bakudan_preview`.

## Production Credential Attempt

The provided `liemdo` credential was also tested without printing the password.

Result:

```text
Server login: PASS
Target DB: bakudan_preview
DB access: FAIL
Error: SQLSTATE[HY000] [1044] Access denied for user 'liemdo' to database 'bakudan_preview'
```

A privilege repair was attempted with the same user:

```text
CREATE DATABASE: FAIL, access denied
GRANT: FAIL, access denied
FLUSH PRIVILEGES: FAIL, missing RELOAD privilege
```

Conclusion: `liemdo` is a valid MySQL login, but DreamHost has not granted it access to `bakudan_preview`.

## Final Fix

DreamHost panel confirmed the actual preview database name:

```text
preview_database
```

The preview environment was patched to:

```text
DB_HOST=mysql-taskflow.bakudanramen.com
DB_PORT=3306
DB_NAME=preview_database
DB_USER=liemdo
```

Result:

```text
DB connection: PASS
Database: preview_database
Table count: 75
HTTP /: 302 -> /login
HTTP /login: 200
```

Preview is no longer blocked by DB connection failure.

## Blocker

Resolved. The root cause was the wrong database name in `.env.preview`:

```text
Wrong: bakudan_preview
Right: preview_database
```

## Required DB Admin Action

In DreamHost/MySQL panel, create or grant a DB user for:

```text
DB_HOST=mysql-taskflow.bakudanramen.com
DB_NAME=bakudan_preview
```

Then update:

```text
~/phase11-preview/.env.preview
```

with the working:

```text
DB_USER=...
DB_PASS=...
```

After that, rerun preview migration and QA.
