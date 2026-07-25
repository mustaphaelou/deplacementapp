# Nextcloud Initial Setup Wizard — Admin Credentials & PostgreSQL Connection
> Generated: 2025-07-25
> Purpose: Primary-source investigation of how Nextcloud's first-run wizard handles admin account creation and PostgreSQL database setup.

## 1. Admin Account Creation Screen — Fields & Validation

### Fields presented

The setup form renders two fields under "Create administration account":

- **Login** (`adminlogin`): Text input for the desired admin username.
- **Password** (`adminpass`): Password input with a real-time strength indicator.

**Source:** [`core/src/views/Setup.vue`](https://github.com/nextcloud/server/blob/master/core/src/views/Setup.vue) (Vue component rendering `<NcTextField>` for login and `<NcPasswordField>` for password under the heading "Create administration account").

The form also accepts an optional `adminemail`, though this is not rendered in the initial wizard UI; it is available via `occ maintenance:install --admin-email`.

**Source:** [`core/Command/Maintenance/Install.php`](https://github.com/nextcloud/server/blob/master/core/Command/Maintenance/Install.php) line showing `->addOption('admin-email', ...)`.

### Password strength validation

The wizard includes a client-side password entropy calculator in `Setup.vue`:

```typescript
enum PasswordStrength {
 VeryWeak, Weak, Moderate, Strong, VeryStrong, ExtremelyStrong,
}

function checkPasswordEntropy(password: string = ''): PasswordStrength {
 const uniqueCharacters = new Set(password)
 const entropy = parseInt(Math.log2(Math.pow(parseInt(uniqueCharacters.size.toString()), password.length)).toFixed(2))
 if (entropy < 16) return PasswordStrength.VeryWeak
 if (entropy < 31) return PasswordStrength.Weak
 if (entropy < 46) return PasswordStrength.Moderate
 if (entropy < 61) return PasswordStrength.Strong
 if (entropy < 76) return PasswordStrength.VeryStrong
 return PasswordStrength.ExtremelyStrong
}
```

Helper text is displayed below the password field: "Password is too weak", "Password is weak", "Password is average", "Password is strong", "Password is very strong", or "Password is extremely strong". A strength below `Moderate` is styled as an error; below `Strong` as a warning; otherwise success.

**Source:** [`core/src/views/Setup.vue`](https://github.com/nextcloud/server/blob/master/core/src/views/Setup.vue) — `passwordHelperText()` and `passwordHelperType()` computed properties.

### Server-side validation

In `Setup::install()` (`lib/private/Setup.php`):

```php
if (empty($options['adminlogin'])) {
    $error[] = $l->t('Set an admin Login.');
}
if (empty($options['adminpass'])) {
    $error[] = $l->t('Set an admin password.');
}
```

Both fields are required. The admin password must be non-empty; the `password_strength` app (if installed) enforces additional rules post-installation, but the base wizard only checks emptiness.

**Source:** [`lib/private/Setup.php`](https://github.com/nextcloud/server/blob/f2ea807b/lib/private/Setup.php) lines 215-220.

## 2. PostgreSQL Connection Options in Web UI

### Database type selector

The wizard shows a radio-button group for database type. If only one PHP database driver is available, the radio group is hidden and a notice is shown: "Only {firstAndOnlyDatabase} is available."

**Source:** [`core/src/views/Setup.vue`](https://github.com/nextcloud/server/blob/master/core/src/views/Setup.vue) — `firstAndOnlyDatabase` computed property and template section rendering database type radios.

### Fields exposed when PostgreSQL is selected

When a non-SQLite database (including PostgreSQL) is selected, the wizard exposes these fields under "Database configuration" / "Database connection":

| Field                     | Input name     | Description                                                                 |
|---------------------------|----------------|-----------------------------------------------------------------------------|
| **Database user**         | `dbuser`       | Username to connect to the database server.                                 |
| **Database password**     | `dbpass`       | Password for the database user.                                             |
| **Database name**         | `dbname`       | Name for the Nextcloud database. The wizard will create it if it doesn't exist and the user has `CREATE DATABASE` privileges. |
| **Database host**         | `dbhost`       | Hostname (and optionally port) of the database server, e.g. `localhost` or `db.example.com:3306`. Default: `localhost`. Unix socket paths are also accepted. Helper hint: "Please specify the port number along with the host name (e.g., localhost:5432)." |
| **Database tablespace**   | `dbtablespace` | Shown only when Oracle is selected; not relevant for PostgreSQL.            |

**Source:** [`docs.nextcloud.com — Installation wizard, Database choice section`](https://docs.nextcloud.com/server/latest/admin_manual/installation/installation_wizard.html#database-choice).

### Autoconfig detection notice

If an `autoconfig.php` file is detected, the wizard displays: "The setup form below is pre-filled with the values from the config file." The Storage & database section is automatically collapsed.

**Source:** Same docs page, "Autoconfig" section.

## 3. DB Connection Validation — How It Works and Pitfalls

### How Nextcloud validates the PostgreSQL connection

Validation happens in `Setup::install()` which delegates to `PostgreSQL::setupDatabase()`:

1. **Connect as admin user**: Connects to the `postgres` maintenance database (not the target database) with the provided credentials via `$this->connect(['dbname' => 'postgres'])`.

2. **Check CREATEROLE privilege** (if `tryCreateDbUser` is enabled):
   ```php
   $query = $builder->select('rolname')
       ->from('pg_roles')
       ->where($builder->expr()->eq('rolcreaterole', new Literal('TRUE')))
       ->andWhere($builder->expr()->eq('rolname', $builder->createNamedParameter($this->dbUser)));
   ```
   If the user has `rolcreaterole = TRUE`, the wizard attempts to create a dedicated `oc_admin` user with a random 30-character password. If the user lacks that privilege, it falls back to using the provided credentials directly.

3. **Create database** (if it doesn't exist):
   ```php
   $query = $connection->prepare('CREATE DATABASE ' . addslashes($this->dbName) . ' OWNER "' . addslashes($this->dbUser) . '"');
   ```

4. **Final connection test**: After setup, the wizard connects to the actual database (with `$this->connect()` and calls `$connection->connect()`). If this throws an exception, it raises:
   ```php
   throw new DatabaseSetupException(
       $this->trans->t('PostgreSQL Login and/or password not valid'),
       $this->trans->t('You need to enter details of an existing account.')
   );
   ```

**Source:** [`lib/private/Setup/PostgreSQL.php`](https://github.com/nextcloud/server/blob/master/lib/private/Setup/PostgreSQL.php) — `setupDatabase()` method.

### Abstract validation in AbstractDatabase

Before connecting, `AbstractDatabase::validate()` checks:

- If both `dbuser` and `dbname` are empty → "Enter the database Login and name for %s"
- If only `dbuser` is empty → "Enter the database Login for %s"
- If only `dbname` is empty → "Enter the database name for %s"
- If `dbname` contains `.` → "You cannot use dots in the database name %s"

**Source:** [`lib/private/Setup/AbstractDatabase.php`](https://github.com/nextcloud/server/blob/f2ea807b/lib/private/Setup/AbstractDatabase.php) — `validate()` method.

### Known quirks and pitfalls

1. **Port/host parsing**: The host field can contain `host:port` syntax. The `connect()` method in `AbstractDatabase` parses this: if the part after `:` is numeric, it's treated as a port; otherwise, it's treated as a Unix socket path. This is the same mechanism for both MySQL and PostgreSQL.

2. **Peer authentication on PostgreSQL**: If PostgreSQL uses `peer` authentication, the host must point to the Unix socket path (e.g., `/var/run/postgresql`), not `localhost`. Using `localhost` with peer authentication will fail because TCP connections use `md5` or `password` auth, not peer.

3. **PostgreSQL 15+ schema permissions**: Starting with PostgreSQL 15, the `CREATE` privilege on the `public` schema is revoked by default. The wizard explicitly grants it:
   ```php
   $connectionMainDatabase->executeQuery(
       'GRANT CREATE ON SCHEMA public TO "' . addslashes($this->dbUser) . '"'
   );
   ```

4. **Single-database-type bug (NC 32)**: When only one database type is available (e.g., only `mysql`/`mariadb`), the radio group is hidden and `dbtype` is not submitted with the form. The `SetupController::loadAutoConfig()` checks `isset($post['dbtype'])` to determine if installation should proceed. Without `dbtype` in POST, the `install` flag is never set, causing the form to reload without installing. Fixed by PR #55560. This affects all single-database scenarios including PostgreSQL-only setups.

**Sources:**
- [`lib/private/Setup/AbstractDatabase.php`](https://github.com/nextcloud/server/blob/f2ea807b/lib/private/Setup/AbstractDatabase.php) — `connect()` method for port/socket parsing.
- [`docs.nextcloud.com — PostgreSQL configuration`](https://docs.nextcloud.com/server/latest/admin_manual/configuration_database/linux_database_configuration.html) — peer auth explanation.
- [`lib/private/Setup/PostgreSQL.php`](https://github.com/nextcloud/server/blob/master/lib/private/Setup/PostgreSQL.php) — GRANT CREATE ON SCHEMA for PG15+.
- [`github.com/nextcloud/server/issues/55554`](https://github.com/nextcloud/server/issues/55554) — single database type bug report.

## 4. Under the Hood — Form Submission Flow

### Entry point: `SetupController::run()`

When the setup form is submitted with `install=true`, the call chain is:

```
POST / (index.php)
  → OC::handleRequest()
    → SetupController::run($_POST)
      → SetupController::loadAutoConfig($post)
        → checks for config/autoconfig.php
        → if dbtype + directory + adminlogin are all set → sets $post['install'] = 'true'
      → SetupHelper::install($post)
```

**Source:** [`core/Controller/SetupController.php`](https://github.com/nextcloud/server/blob/master/core/Controller/SetupController.php) and [`lib/base.php`](https://github.com/nextcloud/server/blob/f2ea807b/lib/base.php) — `handleRequest()` shows the `!installed` guard routing to `SetupController`.

### Step-by-step: `Setup::install()` ([`lib/private/Setup.php`](https://github.com/nextcloud/server/blob/f2ea807b/lib/private/Setup.php))

1. **Validate admin credentials** — checks `adminlogin` and `adminpass` are non-empty.
2. **Validate database config** — calls `AbstractDatabase::validate()`.
3. **Validate data directory** — checks directory exists and is writable.
4. **Generate salt and secret** — random `passwordsalt` (at least 8 chars) and `secret` (at least 64 chars).
5. **Write initial `config.php` values**:
   ```php
   $newConfigValues = [
       'passwordsalt' => $salt,
       'secret' => $secret,
       'trusted_domains' => $trustedDomains,
       'datadirectory' => $dataDir,
       'dbtype' => $dbType,
       'version' => implode('.', Util::getVersion()),
   ];
   $this->config->setValues($newConfigValues);
   ```
   Also sets `overwrite.cli.url` if not already set.

6. **Initialize database setup** — calls `PostgreSQL::initialize()` which stores `dbuser`, `dbpass`, `dbname`, `dbhost`, `dbport`, `tablePrefix` and sets `tryCreateDbUser` from the `setup_create_db_user` config value. It also writes `dbname`, `dbhost`, and `dbtableprefix` to config.

7. **Setup database** — calls `PostgreSQL::setupDatabase()`:
   - Connects to `postgres` maintenance DB
   - Checks for `CREATEROLE` privilege
   - If capable, creates a dedicated `oc_admin` user (with numeric suffix if `oc_admin` already exists) and generates a random 30-character password
   - Writes `dbuser` and `dbpassword` to config
   - Creates the database if it doesn't exist (with `OWNER` set)
   - Grants `CREATE ON SCHEMA public` (PG 15+ compatibility)
   - Connects to the actual database to verify credentials; throws `DatabaseSetupException` on failure

8. **Run core migrations** — calls `MigrationService::migrate('latest', true)` to create all core database tables.

9. **Create admin user** — calls `IUserManager::createUser($username, $password)`.

10. **Post-installation setup**:
    - Sets `core.installedat` and `core.lastupdatedat`
    - Sets `core.vendor` and optionally `updater.release.channel`
    - Creates `admin` group and adds the admin user
    - Installs shipped apps (`Installer::installShippedApps()`)
    - Creates `.ncdata` marker file in data directory
    - Updates `.htaccess` files
    - Installs background jobs (token cleanup, rotation, etc.)
    - Sets `installed = true` in config
    - Removes `CAN_INSTALL` file
    - Runs `BootstrapCoordinator::runInitialRegistration()`
    - Creates session token for the admin user and logs them in
    - Dispatches `InstallationCompletedEvent`

11. **Redirect** — `SetupController::finishSetup()` deletes the `autoconfig.php` file (if it exists), runs integrity check, and redirects to `/index.php/core/apps/recommended`.

### The `occ maintenance:install` equivalent

The CLI command performs the same `Setup::install()` call after validating input. Docker images use this path when all env vars are set.

**Source:** [`core/Command/Maintenance/Install.php`](https://github.com/nextcloud/server/blob/master/core/Command/Maintenance/Install.php) — `execute()` method.

## 5. Environment Variables to Skip the Setup Wizard

### Docker image environment variables

The official Nextcloud Docker image supports two parallel mechanisms:

#### Mechanism A: `occ maintenance:install` path (via `docker-entrypoint.sh`)

If **all** of these groups are set, the entrypoint runs `occ maintenance:install` directly, skipping the wizard entirely:

| Variable                | Required for                | Description                               |
|-------------------------|----------------------------|-------------------------------------------|
| `NEXTCLOUD_ADMIN_USER`  | Always                      | Nextcloud admin username                  |
| `NEXTCLOUD_ADMIN_PASSWORD` | Always                    | Nextcloud admin password                  |
| `POSTGRES_DB`           | PostgreSQL                  | Database name                             |
| `POSTGRES_USER`         | PostgreSQL                  | Database user                             |
| `POSTGRES_PASSWORD`     | PostgreSQL                  | Database password                         |
| `POSTGRES_HOST`         | PostgreSQL                  | Database hostname (e.g., `db`)            |

Each variable also supports a `_FILE` suffix variant (e.g., `POSTGRES_DB_FILE`, `NEXTCLOUD_ADMIN_USER_FILE`) for Docker secrets. The entrypoint reads the file contents via `file_env()`.

The install command built is:
```sh
php /var/www/html/occ maintenance:install \
  --admin-user "$NEXTCLOUD_ADMIN_USER" \
  --admin-pass "$NEXTCLOUD_ADMIN_PASSWORD" \
  --database pgsql \
  --database-name "$POSTGRES_DB" \
  --database-user "$POSTGRES_USER" \
  --database-pass "$POSTGRES_PASSWORD" \
  --database-host "$POSTGRES_HOST"
```

**Source:** [`github.com/nextcloud/docker/docker-entrypoint.sh`](https://github.com/nextcloud/docker/blob/master/docker-entrypoint.sh) lines 190-250 (install path), and [`github.com/nextcloud/docker/README.md`](https://github.com/nextcloud/docker/blob/master/README.md#auto-configuration-via-environment-variables).

#### Mechanism B: `autoconfig.php` path (when admin user is NOT set)

If DB variables are set but `NEXTCLOUD_ADMIN_USER`/`_PASSWORD` are not, the Docker image generates a `.config/autoconfig.php` that Nextcloud's `SetupController::loadAutoConfig()` reads. The autoconfig.php checks:

```php
} elseif (getenv('POSTGRES_DB_FILE') && getenv('POSTGRES_USER_FILE') && getenv('POSTGRES_PASSWORD_FILE') && getenv('POSTGRES_HOST')) {
    $AUTOCONFIG['dbtype'] = 'pgsql';
    $AUTOCONFIG['dbname'] = trim(file_get_contents(getenv('POSTGRES_DB_FILE')));
    $AUTOCONFIG['dbuser'] = trim(file_get_contents(getenv('POSTGRES_USER_FILE')));
    $AUTOCONFIG['dbpass'] = trim(file_get_contents(getenv('POSTGRES_PASSWORD_FILE')));
    $AUTOCONFIG['dbhost'] = getenv('POSTGRES_HOST');
} elseif (getenv('POSTGRES_DB') && getenv('POSTGRES_USER') && getenv('POSTGRES_PASSWORD') && getenv('POSTGRES_HOST')) {
    // same but from plain env vars
}
```

In this path, `$AUTOCONFIG['directory']` is also set from `NEXTCLOUD_DATA_DIR` (defaulting to `/var/www/html/data`).

**Important:** All `_FILE` vars must be used together — mixing `_FILE` and non-`_FILE` variants within the same database type causes the autoconfig to fail silently.

**Source:** [`github.com/nextcloud/docker/.config/autoconfig.php`](https://github.com/nextcloud/docker/blob/master/.config/autoconfig.php) and [`docs.nextcloud.com — Automatic setup`](https://docs.nextcloud.com/server/latest/admin_manual/installation/automatic_configuration.html).

### Raw `config/autoconfig.php` (non-Docker)

For manual/non-Docker installations, create `config/autoconfig.php`:

```php
<?php
$AUTOCONFIG = array(
  "dbtype"        => "pgsql",
  "dbname"        => "nextcloud",
  "dbuser"        => "username",
  "dbpass"        => "password",
  "dbhost"        => "localhost",
  "dbtableprefix" => "",
  "adminlogin"    => "root",
  "adminpass"     => "root-password",
  "directory"     => "/www/htdocs/nextcloud/data",
);
```

When all parameters (dbtype, dbname, dbuser, dbpass, dbhost, adminlogin, adminpass, directory) are provided, the wizard is fully bypassed.

**Source:** [`docs.nextcloud.com — Automatic setup, All parameters`](https://docs.nextcloud.com/server/latest/admin_manual/installation/automatic_configuration.html#all-parameters).

### Key caveats

1. **All-or-nothing per database type**: For PostgreSQL, you must set all of `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_HOST` (or their `_FILE` variants). Missing any one causes the image to fall back to SQLite.

2. **`_FILE` variables must be used in groups**: If you use `POSTGRES_PASSWORD_FILE`, you must also use `POSTGRES_DB_FILE` and `POSTGRES_USER_FILE`. Mixing `POSTGRES_DB` (plain) with `POSTGRES_PASSWORD_FILE` (file) will cause the autoconfig to be skipped.

3. **Admin vars are required for the `occ` path**: The `docker-entrypoint.sh` only runs `occ maintenance:install` when **both** `NEXTCLOUD_ADMIN_USER` and `NEXTCLOUD_ADMIN_PASSWORD` are set. Without them, it falls through to the `autoconfig.php` path, which leaves the web wizard available (though pre-filled).

4. **`setup_create_db_user`**: Set `'setup_create_db_user' => false` in `config.php` or `autoconfig.php` to prevent the wizard from attempting to create a dedicated database user.

5. **`NEXTCLOUD_CONFIG_DIR`**: This env var overrides the config directory path (for both web and CLI), useful for hardening by moving `config.php` outside the webroot.

**Sources:**
- [`github.com/nextcloud/docker/README.md`](https://github.com/nextcloud/docker/blob/master/README.md#auto-configuration-via-environment-variables)
- [`github.com/nextcloud/docker/.config/autoconfig.php`](https://github.com/nextcloud/docker/blob/master/.config/autoconfig.php)
- [`docs.nextcloud.com — Automatic setup`](https://docs.nextcloud.com/server/latest/admin_manual/installation/automatic_configuration.html)
- [`docs.nextcloud.com — Config sample, Environment Variables`](https://docs.nextcloud.com/server/stable/admin_manual/configuration_server/config_sample_php_parameters.html)
- [`docs.nextcloud.com — Installation wizard, Automatic DB user creation`](https://docs.nextcloud.com/server/latest/admin_manual/installation/installation_wizard.html#automatic-database-user-creation)
