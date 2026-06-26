import { runOperatorTask } from './task-runner';
import { OperatorTaskInput } from './types';

export const operatorRuntime = {
  health() {
    return {
      ok: true,
      service: 'operator-runtime',
      mode: 'safe-readonly',
      adapters: ['playwright'],
      version: '0.1.0',
    };
  },

  capabilities() {
    return {
      ok: true,
      service: 'operator-runtime',
      adapters: ['playwright'],
      modes: ['READ_ONLY', 'SAFE_WRITE_TEST_ONLY'],
      actions: ['navigate', 'read_title', 'read_text', 'click', 'fill', 'screenshot', 'download', 'upload_test_file', 'wait', 'extract_links'],
      evidence: ['execution log', 'screenshot', 'HTML snapshot if safe', 'timing', 'errors', 'task input', 'task output', 'policy decision'],
    };
  },

  async runTask(task: OperatorTaskInput) {
    return runOperatorTask(task);
  },
};
