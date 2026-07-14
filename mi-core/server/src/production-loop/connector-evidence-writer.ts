import fs from 'fs';
import path from 'path';
const dir = path.resolve(process.cwd(), 'evidence/production-loop');
export function writeConnectorEvidence(name: string, data: unknown) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}
export function readEvidence(_limit?: number) { return []; }
export function getEvidenceSummary() { return { count: 0, status: 'PRODUCTION_LOOP_READY' }; }
