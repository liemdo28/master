#!/usr/bin/env node
/**
 * Legacy launcher.
 *
 * The old vendor-specific proxy has been replaced by the Universal AI Provider
 * Manager in src/. Keep this file so existing shortcuts and autostart scripts
 * continue to work.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const dir = path.dirname(fileURLToPath(import.meta.url));
const distServer = path.join(dir, 'dist', 'server.js');
const srcServer = path.join(dir, 'src', 'server.ts');

const command = fs.existsSync(distServer) ? process.execPath : 'npx';
const args = fs.existsSync(distServer) ? [distServer] : ['tsx', srcServer];
const child = spawn(command, args, { cwd: dir, stdio: 'inherit', env: process.env });

child.on('exit', code => process.exit(code ?? 0));
