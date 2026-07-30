# TaskFlow v2 — Deploy Guide

## What changed from v1

### New Features

- ✅ **User Registration** — users can self-register (no admin account creation required)
- ✅ **Calendar View** — monthly calendar (Asana-style) displaying tasks by due date
- ✅ **Inbox** — notifications for: task assignments, new comments, tasks approaching or past due
- ✅ **Email Notifications** — automatic email delivery for each notification event
- ✅ **PWA** — installable on Desktop, Android, and iOS
- ✅ **Dark Theme** — professional dark-mode UI
- ✅ **My Tasks** — dedicated page showing all tasks assigned to the current user

### UI Changes

- Professional dark theme (Linear/Asana-inspired)
- Inter font family
- Mobile-responsive layout
- Notification bell with dropdown

---

## Project Overview

**TaskFlow** is a self-hosted project and task management application. It allows teams to create projects, assign tasks, leave comments, track deadlines, and receive notifications — both in-app and via email.

---

## Tech Stack

| Layer       | Technology                          |
|-------------|--------------------------------------|
| Backend     | PHP (vanilla MVC)                    |
| Frontend    | Vanilla JS, CSS                     |
| Database    | MySQL                               |
| Routing     | Custom PHP router (`index.php`)     |
| Background  | Cron job (`cron.php`)               |
| PWA         | Service Worker + Web Manifest       |

---

## Project Structure

```
dashboard.bakudanramen.com/
├── index.php                  ← Router (updated)
├── .htaccess                  ← URL rewriting rules (unchanged)
├── cron.php                   ← NEW: hourly cron job
├── config/
│   └── database.php           ← DB config (unchanged)
├── assets/
│   ├── css/
│   │   └── style.css          ← NEW: dark theme styles
│   ├── js/
│   │   └── app.js             ← NEW: notification handling
│   └── icons/                 ← NEW: PWA icons
├── controllers/
│   ├── AuthController.php         ← Updated: added registration
│   ├── DashboardController.php   ← Updated: calendar, inbox
│   ├── TaskController.php         ← Updated: notifications
│   └── CommentController.php     ← Updated: notifications
├── models/
│   ├── Notification.php          ← NEW
│   └── ... (existing models)
├── views/
│   ├── auth/
│   │   ├── login.php              ← Updated
│   │   └── register.php            ← NEW
│   ├── layouts/
│   │   └── main.php               ← Updated
│   ├── dashboard/
│   │   ├── index.php              ← Updated
│   │   └── my_tasks.php           ← NEW
│   ├── calendar/
│   │   └── index.php              ← NEW
│   └── inbox/
│       └── index.php              ← NEW
└── sql/
    └── schema_v2.sql              ← NEW: run this migration
```

---

## Main Features

| Feature          | Description                                                        |
|------------------|--------------------------------------------------------------------|
| Projects & Tasks | Create projects, add tasks with assignees, due dates, priorities |
| Calendar View    | Monthly calendar showing tasks grouped by due date                 |
| Inbox            | In-app notification feed for assignments, comments, deadlines     |
| Email Alerts     | SMTP-based email notifications triggered by the cron job           |
| PWA              | Installable web app on mobile and desktop (HTTPS required)         |
| Dark Theme       | Full dark-mode UI with Inter font                                  |
| My Tasks         | Personal task dashboard filtered to the logged-in user             |

---

## How to Run (Production Deploy)

### Step 1 — Upload Files

Upload the entire contents of this directory to your hosting via **FTP** or **File Manager** in cPanel, replacing existing files in `dashboard.bakudanramen.com/`.

---

### Step 2 — Run SQL Migration

Open **phpMyAdmin** on your hosting, select the `taskflow_db` database, go to the **SQL** tab, paste the contents of `sql/schema_v2.sql`, and execute.

Or from the MySQL terminal:

```bash
mysql -u liemdo -p taskflow_db < sql/schema_v2.sql
```

---

### Step 3 — Set Up the Cron Job (Email Notifications)

In **cPanel → Cron Jobs**, add a cron job running **every hour**:

```bash
0 * * * * /usr/local/bin/php /home/YOUR_USERNAME/dashboard.bakudanramen.com/cron.php
```

Replace `YOUR_USERNAME` with your actual cPanel username.

The cron job handles:
- Detecting tasks nearing their deadline → sends notifications
- Detecting overdue tasks → sends notifications
- Processing the email queue

> **Note:** To secure the cron endpoint, update the `$expectedKey` variable in `cron.php` with a secret key, and call it as `cron.php?key=YOUR_SECRET_KEY`.

---

### Step 4 — Install PWA

#### Android
1. Open Chrome → navigate to `dashboard.bakudanramen.com`
2. Log in
3. Chrome will show an "Add to Home screen" prompt → tap **Install**
4. The TaskFlow app icon will appear on the home screen

#### iOS (iPhone / iPad)
1. Open Safari → navigate to `dashboard.bakudanramen.com`
2. Tap the **Share** button (square with upward arrow)
3. Select **"Add to Home Screen"**
4. Name it "TaskFlow" and tap **Add**

#### Desktop (Windows / Mac)
1. Open Chrome → navigate to `dashboard.bakudanramen.com`
2. Click the **Install** icon (⊕) in the address bar
3. Or: Chrome Menu → "Install TaskFlow"
4. The app will open as a standalone desktop window

> **Note:** PWA installation requires HTTPS. If you don't have an SSL certificate, go to **cPanel → SSL/TLS** and install a free Let's Encrypt certificate.

---

## Configuration

The `config/database.php` file should already be configured. No changes are required there.

If you want to secure the cron endpoint, update the `$expectedKey` variable in `cron.php` with a custom secret key.

---

## Testing Checklist

After deploying, verify each of the following:

1. Open `dashboard.bakudanramen.com` — the dark-themed login page should load
2. Click **Register** — create a new user account
3. Log in → the Dashboard should show stats and tasks
4. Click **Calendar** in the sidebar — the monthly calendar view should render
5. Create a task and assign it to another user → they should see a notification in their **Inbox**
6. Complete a PWA installation on your device (see Step 4)

---

## Developer Notes

- **Database schema changes** are all contained in `sql/schema_v2.sql`. Review it before running to understand which new tables and columns are being added.
- **Notifications** are stored in the `notifications` table (new in v2) and processed by the cron job, which dispatches emails via SMTP.
- **PWA assets** (icons and manifest) live in `assets/icons/`. Update these if you rebrand the app.
- **Dark theme** is applied via `assets/css/style.css`. All views extend the `layouts/main.php` template.
- The **Inter font** is loaded via the main layout. Ensure your environment allows external font loading, or self-host the font if needed.
