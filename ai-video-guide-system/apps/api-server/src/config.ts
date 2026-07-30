import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? './data/api-server.db',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  playwrightRunnerUrl: process.env.PLAYWRIGHT_RUNNER_URL ?? 'http://localhost:3002',
  remotionRendererUrl: process.env.REMOTION_RENDERER_URL ?? 'http://localhost:3003',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  storageBasePath: process.env.STORAGE_BASE_PATH ?? './storage',
};