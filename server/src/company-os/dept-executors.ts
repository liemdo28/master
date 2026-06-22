/**
 * Mi Company OS — Department Executor Registry
 * Wires all working department implementations into the execution pipeline.
 *
 * The execution-pipeline calls runPipeline(ctx, getDeptExecutors()).
 * Each executor receives (pipelineId, deptId, intent, command) and returns DeptReport.
 */

import type { DeptExecutor } from './execution-pipeline';
import { executeAccountingRequest } from './accounting-department';
import { executeExecutiveAssistant } from './executive-assistant-department';
import { executeReportingRequest } from './reporting-department';
import { executeEngineeringRequest } from './engineering-department';
import { executeQaDepartment } from './qa-department';
import { runDepartment } from './department-runtime';
import type { DeptReport } from './report-center';

// Generic dept executor — uses department-runtime with correct brain + tools
function makeGenericExecutor(deptId: string): DeptExecutor {
  return async (pipelineId, _deptId, intent, command) => {
    const result = await runDepartment({ pipeline_id: pipelineId, dept_id: deptId, intent, command });
    return result as DeptReport;
  };
}

export function getDeptExecutors(): Partial<Record<string, DeptExecutor>> {
  return {
    // Phase 1 — ACTIVE
    'executive-assistant': async (pid, _did, intent, cmd) => {
      return executeExecutiveAssistant({ pipeline_id: pid, intent, command: cmd });
    },
    'report-center': async (pid, _did, intent, cmd) => {
      return executeReportingRequest({ pipeline_id: pid, intent, command: cmd });
    },
    'qa': async (pid, _did, intent, cmd) => {
      return executeQaDepartment({ pipeline_id: pid, exec_dept_id: _did, original_command: cmd });
    },

    // Phase 2 — ACTIVE
    'finance': async (pid, _did, intent, cmd) => {
      return executeAccountingRequest({ pipeline_id: pid, intent, command: cmd });
    },
    'restaurant-intelligence': makeGenericExecutor('restaurant-intelligence'),

    // Phase 3 — ACTIVE
    'engineering': async (pid, _did, intent, cmd) => {
      return executeEngineeringRequest({ pipeline_id: pid, intent, command: cmd });
    },
    'technical-operations': makeGenericExecutor('technical-operations'),

    // Phase 4 — ACTIVE
    'marketing':     makeGenericExecutor('marketing'),
    'brand-creative': makeGenericExecutor('brand-creative'),
  };
}
