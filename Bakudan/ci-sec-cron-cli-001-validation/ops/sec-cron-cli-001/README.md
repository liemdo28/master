# SEC-CRON-CLI-001 Private CLI Runner

Prepared target layout:

```text
~/taskflow-private/
+-- cron/
|   +-- cron.php
|   +-- bootstrap.php
+-- logs/
+-- locks/
+-- config/
    +-- production.env
```

Sanitized DreamHost cron target:

```text
/usr/bin/php ~/taskflow-private/cron/cron.php --execute-approved >> ~/taskflow-private/logs/cron.stdout.log 2>&1
```

Required private environment entries:

```text
APP_ENV=production
APP_ENV_FILE=/home/<user>/taskflow-private/config/production.env
TASKFLOW_PRIVATE_ROOT=/home/<user>/taskflow-private
TASKFLOW_APP_ROOT=/home/<user>/dashboard.bakudanramen.com
TASKFLOW_EXPECTED_DB_NAME=taskflow_db
SEC_CRON_CLI_001_APPROVED=1
```

The private env file must also contain the existing production runtime variables needed by the app.
Do not commit secrets or pass secrets in cron command arguments.

Validation commands, after CEO approval for preparation only:

```text
/usr/bin/php -l ~/taskflow-private/cron/bootstrap.php
/usr/bin/php -l ~/taskflow-private/cron/cron.php
/usr/bin/php ~/taskflow-private/cron/cron.php --dry-run
```

Activation remains blocked until:

```text
SEC-CRON-CLI-001 ACTIVATION: CEO APPROVED
```
