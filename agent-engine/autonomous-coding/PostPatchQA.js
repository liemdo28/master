import { spawnSync } from 'node:child_process';
import { QAOrchestrator } from '../qa-orchestrator/QAOrchestrator.js';

export class PostPatchQA {
  constructor({ projectPath, projectName, qaCommand, qaFunction, runFullQA = false } = {}) {
    this.projectPath = projectPath;
    this.projectName = projectName || 'Project';
    this.qaCommand = qaCommand;
    this.qaFunction = qaFunction;
    this.runFullQA = runFullQA;
  }

  async run() {
    const t0 = Date.now();
    if (this.qaFunction) {
      const result = await this.qaFunction();
      return { ok: result.ok === true, mode: 'function', durationMs: Date.now() - t0, ...result };
    }
    if (this.qaCommand) {
      const result = spawnSync(this.qaCommand.command, this.qaCommand.args || [], {
        cwd: this.projectPath,
        encoding: 'utf8',
        shell: false,
      });
      return {
        ok: result.status === 0,
        mode: 'command',
        command: [this.qaCommand.command, ...(this.qaCommand.args || [])].join(' '),
        exitCode: result.status,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        durationMs: Date.now() - t0,
      };
    }
    if (this.runFullQA) {
      const qa = new QAOrchestrator({ projectPath: this.projectPath, projectName: this.projectName });
      return { mode: 'orchestrator', ...(await qa.runFullQA()) };
    }
    return { ok: true, mode: 'noop', durationMs: Date.now() - t0, note: 'No QA command configured' };
  }
}
