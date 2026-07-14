import fs from 'fs';
import path from 'path';
export function writeGraphEvidence(name: string, data: unknown) { const dir = path.resolve(process.cwd(), 'evidence/knowledge-graph'); fs.mkdirSync(dir, { recursive: true }); const file = path.join(dir, name); fs.writeFileSync(file, JSON.stringify(data, null, 2)); return file; }
