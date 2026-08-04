/**
 * AST edit plan execution.
 *
 * Applies a model-produced EditPlan operation by operation, rolling the whole
 * plan back if any operation fails. A half-applied plan is worse than none: the
 * validation output would then describe a state the model never intended.
 */

import * as fs from 'fs';
import { applyOperation, SUPPORTED_OPERATIONS } from './operations';
import { loadFile } from './locate';
import { EditOperationError, type EditOperation, type EditPlan, type OperationResult } from './types';

export * from './types';
export { SUPPORTED_OPERATIONS, applyOperation } from './operations';
export { collectDeclarations, findDeclaration, loadFile } from './locate';

export interface ApplyPlanInput {
  worktreePath: string;
  allowedPaths: Set<string>;
  plan: EditPlan;
  /** Ceiling on total changed lines across the plan. */
  maxChangedLines?: number;
}

export interface ApplyPlanResult {
  results: OperationResult[];
  changedFiles: string[];
  totalChangedLines: number;
}

export function applyEditPlan(input: ApplyPlanInput): ApplyPlanResult {
  const operations = (input.plan?.operations ?? []).filter(Boolean);
  if (!operations.length) {
    throw new EditOperationError('INVALID_PARAMETERS', 'edit plan contains no operations');
  }

  const backups = new Map<string, string>();
  const results: OperationResult[] = [];
  const changedFiles = new Set<string>();
  let totalChangedLines = 0;

  const snapshot = (operation: EditOperation): void => {
    try {
      const file = loadFile({ worktreePath: input.worktreePath, allowedPaths: input.allowedPaths }, operation.targetFile);
      if (!backups.has(file.absolute)) backups.set(file.absolute, file.text);
    } catch {
      // Validation inside applyOperation reports the real reason.
    }
  };

  try {
    for (const operation of operations) {
      snapshot(operation);
      const result = applyOperation({ worktreePath: input.worktreePath, allowedPaths: input.allowedPaths }, operation);
      results.push(result);
      for (const file of result.changedFiles) changedFiles.add(file);
      totalChangedLines += result.changedLines;

      // Compared against undefined rather than truthiness: a budget of 0 is a
      // meaningful "no changes permitted" and must not be read as "no budget".
      if (input.maxChangedLines !== undefined && totalChangedLines > input.maxChangedLines) {
        throw new EditOperationError(
          'UNRELATED_CHANGE',
          `edit plan changed ${totalChangedLines} lines, over the ${input.maxChangedLines}-line budget`
        );
      }
    }
  } catch (err) {
    for (const [absolute, original] of backups) {
      try {
        fs.writeFileSync(absolute, original);
      } catch {
        // Best-effort restore; the original failure is what matters.
      }
    }
    throw err;
  }

  return { results, changedFiles: [...changedFiles], totalChangedLines };
}

/** Human-readable catalogue for the prompt, so the model sees real parameters. */
export const OPERATION_CATALOGUE = `Available operations and their parameters:

- add_property_to_object   { property, value }              targetSymbol = enclosing function
- update_route_response_field { field, value }              sourceLocation.near = route path fragment
- rename_symbol            { to }                           targetSymbol = current name
- update_function_return_type { returnType }                targetSymbol = function name
- replace_expression       { from, to }                     targetSymbol = enclosing function
- insert_statement         { statement, position }          position = "start" | "end"
- add_import               { module, names[], typeOnly? }
- remove_import            { module, name? }
- extract_function         { newFunctionName, startLine, endLine, parameters?, returnType? }
                                                            targetSymbol = function to extract FROM
- move_function            { before } or { position: "end" } targetSymbol = function to move

For extract_function you supply only the line range and a name. The statements
are moved for you, so you never rewrite the body.`;

export function isSupportedOperation(operationType: string): boolean {
  return SUPPORTED_OPERATIONS.includes(operationType);
}
