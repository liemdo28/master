# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\mobile-regression.spec.js >> Mobile Regression -- iPhone-15-Plus (430x932) >> Flow 5: KPI Drilldown -- Compliance Risk
- Location: tests\mobile-regression.spec.js:116:5

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "compliance"
Received string:    "https://dashboard.bakudanramen.com/login"
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - link "VI" [ref=e4] [cursor=pointer]:
      - /url: https://dashboard.bakudanramen.com/language/vi?redirect=%2Flogin
    - link "EN" [ref=e5] [cursor=pointer]:
      - /url: https://dashboard.bakudanramen.com/language/en?redirect=%2Flogin
  - generic [ref=e6]:
    - generic [ref=e7]:
      - generic [ref=e8]: TF
      - generic [ref=e9]:
        - heading "TaskFlow" [level=1] [ref=e10]
        - paragraph [ref=e11]: Bakudan Ramen
    - generic [ref=e12]:
      - generic [ref=e13]: Secure Access
      - heading "Sign in to continue" [level=2] [ref=e14]
    - generic [ref=e16]:
      - generic [ref=e17]:
        - generic [ref=e18]: Email
        - textbox "Email" [active] [ref=e19]:
          - /placeholder: you@company.com
      - generic [ref=e20]:
        - generic [ref=e21]: Password
        - textbox "Password" [ref=e22]:
          - /placeholder: ••••••••
      - generic [ref=e23]:
        - checkbox "Giữ đăng nhập trong 30 ngày" [ref=e24] [cursor=pointer]
        - generic [ref=e25] [cursor=pointer]: Giữ đăng nhập trong 30 ngày
      - button "Sign In" [ref=e26] [cursor=pointer]
    - generic [ref=e27]:
      - generic [ref=e28]: Don't have an account?
      - link "Register now" [ref=e29] [cursor=pointer]:
        - /url: https://dashboard.bakudanramen.com/register
```

# Test source

```ts
  23  | async function getBodyText(page) {
  24  |   try {
  25  |     return await page.evaluate(() => document.body ? document.body.innerText : '', { timeout: 15000 });
  26  |   } catch (e) {
  27  |     // On polling pages, evaluate may timeout — return empty to skip text checks
  28  |     return '';
  29  |   }
  30  | }
  31  | 
  32  | async function login(page) {
  33  |   await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle' });
  34  |   await page.fill('input[name="email"], input[type="email"]', EMAIL);
  35  |   await page.fill('input[name="password"], input[type="password"]', PASSWORD);
  36  |   await page.click('button[type="submit"], input[type="submit"]');
  37  |   await page.waitForURL(/(overview|dashboard|my-tasks)/, { timeout: 15000 });
  38  | }
  39  | 
  40  | async function assertNoInternalError(page) {
  41  |   const text = await getBodyText(page);
  42  |   expect(text).not.toContain('Something went wrong');
  43  |   expect(text).not.toContain('An internal error occurred');
  44  |   expect(text).not.toContain('Internal Error');
  45  |   expect(text).not.toContain('Fatal error');
  46  |   expect(text).not.toContain('Parse error');
  47  |   expect(text).not.toContain('Notice: Undefined');
  48  |   expect(text).not.toContain('Warning: ');
  49  |   expect(text).not.toMatch(/\b500\s+Internal Server Error\b/);
  50  |   expect(text).not.toMatch(/\bError\s+500\b/);
  51  |   expect(text).not.toMatch(/status[:\s]+500\b/);
  52  | }
  53  | 
  54  | async function assertNoHorizontalScroll(page) {
  55  |   const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  56  |   const cw = await page.evaluate(() => document.documentElement.clientWidth);
  57  |   expect(sw).toBeLessThanOrEqual(cw + 2);
  58  | }
  59  | 
  60  | async function assertPageHasContent(page) {
  61  |   const text = await getBodyText(page);
  62  |   expect(text.length).toBeGreaterThan(100);
  63  | }
  64  | 
  65  | for (const [deviceName, viewport] of Object.entries(DEVICES)) {
  66  |   test.describe('Mobile Regression -- ' + deviceName + ' (' + viewport.width + 'x' + viewport.height + ')', () => {
  67  |     test.use({
  68  |       viewport: { width: viewport.width, height: viewport.height },
  69  |       userAgent: deviceName.includes('iPad')
  70  |         ? 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
  71  |         : 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36',
  72  |       hasTouch: !deviceName.includes('iPad') || true,
  73  |       isMobile: !deviceName.includes('iPad'),
  74  |     });
  75  | 
  76  |     test('Flow 1: Login', async ({ page }) => {
  77  |       await login(page);
  78  |       await expect(page).toHaveURL(/(overview|dashboard|my-tasks)/);
  79  |     });
  80  | 
  81  |     test('Flow 2: Overview loads without error', async ({ page }) => {
  82  |       await login(page);
  83  |       // Overview has long-polling; use domcontentloaded + evaluate (not textContent)
  84  |       await page.goto(BASE_URL + '/overview', { waitUntil: 'domcontentloaded', timeout: 90000 });
  85  |       await page.waitForTimeout(500);
  86  |       await assertNoInternalError(page);
  87  |       await assertNoHorizontalScroll(page);
  88  |       await assertPageHasContent(page);
  89  |       if (viewport.width <= 768) {
  90  |         const sidebarHidden = await page.locator('#sidebar').evaluate(el => {
  91  |           const s = getComputedStyle(el);
  92  |           return parseFloat(s.left) < 0 || s.display === 'none' || s.transform !== 'none';
  93  |         });
  94  |         expect(sidebarHidden).toBeTruthy();
  95  |       }
  96  |     });
  97  | 
  98  |     test('Flow 3: KPI Drilldown -- Overdue Bills', async ({ page }) => {
  99  |       await login(page);
  100 |       await page.goto(BASE_URL + '/overview/drilldown/overdue-bills', { waitUntil: 'domcontentloaded', timeout: 30000 });
  101 |       await page.waitForTimeout(500);
  102 |       await assertNoInternalError(page);
  103 |       await assertNoHorizontalScroll(page);
  104 |       await assertPageHasContent(page);
  105 |     });
  106 | 
  107 |     test('Flow 4: KPI Drilldown -- Critical Tasks', async ({ page }) => {
  108 |       await login(page);
  109 |       await page.goto(BASE_URL + '/overview/drilldown/critical-tasks', { waitUntil: 'domcontentloaded', timeout: 30000 });
  110 |       await page.waitForTimeout(2000);
  111 |       await assertNoInternalError(page);
  112 |       await assertNoHorizontalScroll(page);
  113 |       await assertPageHasContent(page);
  114 |     });
  115 | 
  116 |     test('Flow 5: KPI Drilldown -- Compliance Risk', async ({ page }) => {
  117 |       await login(page);
  118 |       await page.goto(BASE_URL + '/overview/drilldown/compliance-risk', { waitUntil: 'domcontentloaded', timeout: 30000 });
  119 |       await page.waitForTimeout(2000);
  120 |       await assertNoInternalError(page);
  121 |       await assertNoHorizontalScroll(page);
  122 |       await assertPageHasContent(page);
> 123 |       expect(page.url()).toContain('compliance');
      |                          ^ Error: expect(received).toContain(expected) // indexOf
  124 |     });
  125 | 
  126 |     test('Flow 6: KPI Drilldown -- Penalty', async ({ page }) => {
  127 |       await login(page);
  128 |       await page.goto(BASE_URL + '/overview/drilldown/penalty', { waitUntil: 'domcontentloaded', timeout: 30000 });
  129 |       await page.waitForTimeout(2000);
  130 |       await assertNoInternalError(page);
  131 |       await assertNoHorizontalScroll(page);
  132 |       await assertPageHasContent(page);
  133 |     });
  134 | 
  135 |     test('Flow 7: Task Drawer -- open task from list', async ({ page }) => {
  136 |       await login(page);
  137 |       await page.goto(BASE_URL + '/my-tasks', { waitUntil: 'domcontentloaded', timeout: 30000 });
  138 |       await page.waitForTimeout(2000);
  139 |       await assertNoInternalError(page);
  140 |       const taskLink = page.locator('a[href*="tasks/show"], .task-row, .task-item, [data-task-id], tr:has(a)').first();
  141 |       if (await taskLink.isVisible()) {
  142 |         await taskLink.click();
  143 |         await page.waitForTimeout(2000);
  144 |         await assertNoInternalError(page);
  145 |         const body = await getBodyText(page);
  146 |         expect(body.length).toBeGreaterThan(100);
  147 |       }
  148 |     });
  149 | 
  150 |     test('Flow 8: Bill Drawer -- open bill from list', async ({ page }) => {
  151 |       await login(page);
  152 |       await page.goto(BASE_URL + '/bills', { waitUntil: 'domcontentloaded', timeout: 30000 });
  153 |       await page.waitForTimeout(2000);
  154 |       await assertNoInternalError(page);
  155 |       const billLink = page.locator('a[href*="bills/show"], .bill-row, .bill-item, [data-bill-id], tr:has(a)').first();
  156 |       if (await billLink.isVisible()) {
  157 |         await billLink.click();
  158 |         await page.waitForTimeout(2000);
  159 |         await assertNoInternalError(page);
  160 |         const body = await getBodyText(page);
  161 |         expect(body.length).toBeGreaterThan(100);
  162 |       }
  163 |     });
  164 | 
  165 |     test('Flow 9: Calendar page loads', async ({ page }) => {
  166 |       await login(page);
  167 |       await page.goto(BASE_URL + '/calendar', { waitUntil: 'domcontentloaded', timeout: 30000 });
  168 |       await page.waitForTimeout(2000);
  169 |       await assertNoInternalError(page);
  170 |       await assertNoHorizontalScroll(page);
  171 |       await assertPageHasContent(page);
  172 |     });
  173 | 
  174 |     test('Flow 10: Inbox page loads', async ({ page }) => {
  175 |       await login(page);
  176 |       await page.goto(BASE_URL + '/inbox', { waitUntil: 'domcontentloaded', timeout: 30000 });
  177 |       await page.waitForTimeout(2000);
  178 |       await assertNoInternalError(page);
  179 |       await assertNoHorizontalScroll(page);
  180 |     });
  181 | 
  182 |     test('Flow 11: Create Task', async ({ page }) => {
  183 |       await login(page);
  184 |       await page.goto(BASE_URL + '/my-tasks', { waitUntil: 'domcontentloaded', timeout: 30000 });
  185 |       await page.waitForTimeout(2000);
  186 |       const createBtn = page.locator('a:has-text("Create"), a:has-text("New Task"), button:has-text("Create"), a[href*="create"], a[href*="new"]').first();
  187 |       if (await createBtn.isVisible()) {
  188 |         await createBtn.click();
  189 |         await page.waitForTimeout(2000);
  190 |         await assertNoInternalError(page);
  191 |       } else {
  192 |         await page.goto(BASE_URL + '/tasks/create', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  193 |         await page.waitForTimeout(1000);
  194 |         await assertNoInternalError(page);
  195 |       }
  196 |     });
  197 | 
  198 |     test('Flow 12: Edit Task -- open task detail', async ({ page }) => {
  199 |       await login(page);
  200 |       await page.goto(BASE_URL + '/my-tasks', { waitUntil: 'domcontentloaded', timeout: 30000 });
  201 |       await page.waitForTimeout(2000);
  202 |       await assertNoInternalError(page);
  203 |       const editLink = page.locator('a[href*="tasks/edit"], a[href*="edit"], .task-row a, .task-item a').first();
  204 |       if (await editLink.isVisible()) {
  205 |         await editLink.click();
  206 |         await page.waitForTimeout(2000);
  207 |         await assertNoInternalError(page);
  208 |         const body = await getBodyText(page);
  209 |         expect(body.length).toBeGreaterThan(100);
  210 |       } else {
  211 |         const body = await getBodyText(page);
  212 |         expect(body.length).toBeGreaterThan(100);
  213 |       }
  214 |     });
  215 | 
  216 |     test('Flow 13: Mobile Navigation -- bottom nav exists', async ({ page }) => {
  217 |       await login(page);
  218 |       await page.goto(BASE_URL + '/overview', { waitUntil: 'domcontentloaded', timeout: 90000 });
  219 |       await page.waitForTimeout(3000);
  220 |       await assertNoInternalError(page);
  221 |       if (viewport.width <= 768) {
  222 |         const navVisible = await page.locator('#mobileBottomNav, .mobile-bottom-nav, .bottom-nav, nav.mobile-nav').first().isVisible().catch(() => false);
  223 |         const hamburger = await page.locator('.hamburger, .menu-toggle, .navbar-toggler').first().isVisible().catch(() => false);
```