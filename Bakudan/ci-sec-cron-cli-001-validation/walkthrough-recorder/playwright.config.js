/**
 * Playwright configuration for walkthrough recordings.
 * Uses persistent browser context for Cloudflare bypass.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const TARGET_URL = process.env.TARGET_URL || 'https://dashboard.bakudanramen.com';
const HEADLESS = process.env.HEADLESS === '1';
const SLOW_MO = parseInt(process.env.SLOW_MO_MS || '250', 10);
const USER_DATA_DIR = path.join(__dirname, process.env.WALKTHROUGH_USER_DATA_DIR || '.user-data');

module.exports = {
    TARGET_URL,
    HEADLESS,
    SLOW_MO,
    USER_DATA_DIR,
    VIEWPORT: { width: 1440, height: 900 },
    RECORDING_DIR: path.join(__dirname, 'recordings'),
    OUTPUT_DIR: path.join(__dirname, 'output'),
    SCREENSHOT_DIR: path.join(__dirname, 'screenshots'),
    REPORT_DIR: path.join(__dirname, 'reports'),

    // Credentials per role (from .env.local)
    CREDENTIALS: {
        ceo: {
            email: process.env.WALKTHROUGH_EMAIL || 'hoangdle@gmail.com',
            password: process.env.WALKTHROUGH_PASSWORD || '',
        },
        manager: {
            email: process.env.WALKTHROUGH_MANAGER_EMAIL || process.env.WALKTHROUGH_EMAIL,
            password: process.env.WALKTHROUGH_MANAGER_PASSWORD || process.env.WALKTHROUGH_PASSWORD,
        },
        member: {
            email: process.env.WALKTHROUGH_MEMBER_EMAIL || process.env.WALKTHROUGH_EMAIL,
            password: process.env.WALKTHROUGH_MEMBER_PASSWORD || process.env.WALKTHROUGH_PASSWORD,
        },
        admin: {
            email: process.env.WALKTHROUGH_ADMIN_EMAIL || process.env.WALKTHROUGH_EMAIL,
            password: process.env.WALKTHROUGH_ADMIN_PASSWORD || process.env.WALKTHROUGH_PASSWORD,
        },
    },

    // Minimum walkthrough duration (seconds)
    // 90s for interactive (HEADLESS=0), 20s for automated headless runs
    MIN_DURATION_SECONDS: process.env.HEADLESS === '1' ? 20 : 90,

    // Pages each role must visit
    ROLE_ROUTES: {
        ceo: [
            '/overview',
            '/control-tower',
            '/operations/today',
            '/admin/releases',
            '/admin/store-command',
            '/ceo/scorecard',
            '/my-tasks',
            '/projects',
        ],
        manager: [
            '/overview',
            '/manager/command',
            '/action-center',
            '/my-tasks',
            '/projects',
            '/team',
            '/admin/shifts',
        ],
        member: [
            '/my-tasks',
            '/my-workspace',
            '/my-day',
            '/calendar',
            '/notifications',
            '/activity',
        ],
        admin: [
            '/overview',
            '/admin/releases',
            '/admin/store-command',
            '/admin/employees',
            '/admin/training',
            '/admin/users',
            '/admin/walkthrough-library',
            '/health',
        ],
    },
};
