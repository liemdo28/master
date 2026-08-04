import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { analyzeChangeImpact } from '../impact-graph';

let passed = 0;
function check(label: string, condition: boolean, detail = ''): void {
  if (!condition) throw new Error(`FAILED: ${label} ${detail}`);
  passed += 1;
  console.log(`[impact-graph] ok  ${label}`);
}

function write(root: string, relative: string, content: string): void {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function makeRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-impact-'));
  write(root, 'src/services/order-service.ts', `
export interface OrderSummary { id: string; total: number; }
export function listOrders(): OrderSummary[] {
  return [{ id: 'o1', total: 25 }];
}
`);
  write(root, 'src/controllers/order-controller.ts', `
import { listOrders } from '../services/order-service';
export function handleOrders() {
  return { status: 200, body: { orders: listOrders() } };
}
`);
  write(root, 'test/order-controller.test.ts', `
import { handleOrders } from '../src/controllers/order-controller';
export function testOrders() { return handleOrders().body.orders.length; }
`);

  write(root, 'src/serializers/profile-serializer.ts', `
export function serializeProfile(user: { id: string; name: string }) {
  return { id: user.id, name: user.name };
}
`);
  write(root, 'src/routes/profile-route.ts', `
import { serializeProfile } from '../serializers/profile-serializer';
const router = { get(_path: string, _handler: unknown) {} };
router.get('/profile/:id', (_req, res) => res.json({ profile: serializeProfile({ id: 'u1', name: 'A' }) }));
export { router };
`);
  write(root, 'test/profile-route.test.ts', `
import { router } from '../src/routes/profile-route';
const routePath = '/profile/:id';
export function testProfileRoute() { return [router, routePath]; }
`);

  write(root, 'src/domain/invoice-types.ts', `
export interface InvoiceRecord { id: string; amount: number; }
`);
  write(root, 'src/services/invoice-service.ts', `
import { InvoiceRecord } from '../domain/invoice-types';
export function total(invoice: InvoiceRecord) { return invoice.amount; }
`);
  write(root, 'test/invoice-service.test.ts', `
import { total } from '../src/services/invoice-service';
export function testInvoice() { return total({ id: 'i1', amount: 10 }); }
`);

  write(root, 'src/lib/format.ts', `
export function pad(value: string) {
  return value.trim();
}
`);
  return root;
}

function run(): void {
  const root = makeRepo();
  const files = [
    'src/services/order-service.ts',
    'src/controllers/order-controller.ts',
    'test/order-controller.test.ts',
    'src/serializers/profile-serializer.ts',
    'src/routes/profile-route.ts',
    'test/profile-route.test.ts',
    'src/domain/invoice-types.ts',
    'src/services/invoice-service.ts',
    'test/invoice-service.test.ts',
    'src/lib/format.ts',
  ];

  const serviceImpact = analyzeChangeImpact({
    worktreePath: root,
    candidatePaths: files,
    plannedFiles: ['src/services/order-service.ts', 'src/controllers/order-controller.ts', 'test/order-controller.test.ts'],
    changedFiles: ['src/services/order-service.ts', 'src/controllers/order-controller.ts'],
    requireConsumerEdits: true,
  });
  check('A. service change requires controller', serviceImpact.requiredFiles.includes('src/controllers/order-controller.ts'), JSON.stringify(serviceImpact));
  check('A2. service change traces related test', serviceImpact.impactedTests.includes('test/order-controller.test.ts'));
  check('A3. service and controller update is accepted', serviceImpact.rejectionReasons.length === 0, serviceImpact.rejectionReasons.join('; '));

  const responseImpact = analyzeChangeImpact({
    worktreePath: root,
    candidatePaths: files,
    plannedFiles: ['src/serializers/profile-serializer.ts', 'src/routes/profile-route.ts', 'test/profile-route.test.ts'],
    changedFiles: ['src/serializers/profile-serializer.ts', 'src/routes/profile-route.ts'],
    requireConsumerEdits: true,
  });
  check('B. serializer change requires route consumer', responseImpact.requiredFiles.includes('src/routes/profile-route.ts'), JSON.stringify(responseImpact));
  check('B2. API response change traces route test', responseImpact.impactedTests.includes('test/profile-route.test.ts'));
  check('B3. route and serializer update is accepted', responseImpact.rejectionReasons.length === 0, responseImpact.rejectionReasons.join('; '));

  const typeImpact = analyzeChangeImpact({
    worktreePath: root,
    candidatePaths: files,
    plannedFiles: ['src/domain/invoice-types.ts', 'src/services/invoice-service.ts', 'test/invoice-service.test.ts'],
    changedFiles: ['src/domain/invoice-types.ts', 'src/services/invoice-service.ts'],
    requireConsumerEdits: true,
  });
  check('C. shared type change requires direct consumer', typeImpact.requiredFiles.includes('src/services/invoice-service.ts'), JSON.stringify(typeImpact));
  check('C2. shared type change traces consumer test', typeImpact.impactedTests.includes('test/invoice-service.test.ts'));
  check('C3. type and consumer update is accepted', typeImpact.rejectionReasons.length === 0, typeImpact.rejectionReasons.join('; '));

  const internalImpact = analyzeChangeImpact({
    worktreePath: root,
    candidatePaths: files,
    plannedFiles: ['src/lib/format.ts'],
    changedFiles: ['src/lib/format.ts'],
    requireConsumerEdits: true,
  });
  check('D. internal-only change requires only one file', internalImpact.requiredFiles.length === 0, JSON.stringify(internalImpact));
  check('D2. internal-only change is low risk', internalImpact.riskLevel === 'low', internalImpact.riskLevel);

  const rejected = analyzeChangeImpact({
    worktreePath: root,
    candidatePaths: files,
    plannedFiles: ['src/services/order-service.ts', 'test/order-controller.test.ts'],
    changedFiles: ['src/services/order-service.ts'],
    requireConsumerEdits: true,
  });
  check('reject. producer-only edit is refused', rejected.rejectionReasons.some(reason => reason.includes('required consumer ignored')), rejected.rejectionReasons.join('; '));

  fs.rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  console.log(`\n[impact-graph] PASS — ${passed} assertions`);
}

run();
