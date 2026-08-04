/**
 * AST-guided edit contract.
 *
 * The measured failure across every local model is anchor reproduction: asked to
 * restructure a long function, the model returns a search block that does not
 * match the file character-for-character, and the patch is refused. The model is
 * reasoning correctly and failing at transcription.
 *
 * This contract removes the transcription. The model chooses an *operation* and
 * its parameters; Mi locates the target in the AST and performs the edit
 * deterministically. For an extract-function the model never writes the body at
 * all — it names a statement range, and Mi moves those exact statements.
 *
 * Nothing here is aware of any particular file, symbol or task.
 */

export type EditOperationType =
  | 'add_property_to_object'
  | 'rename_symbol'
  | 'update_function_return_type'
  | 'replace_expression'
  | 'insert_statement'
  | 'add_import'
  | 'remove_import'
  | 'update_route_response_field'
  | 'extract_function'
  | 'move_function';

/** How the model points at a location without transcribing it. */
export interface SourceLocation {
  /** Enclosing declaration: a function, class or interface name. */
  symbol?: string;
  /** 1-based inclusive line range, when the operation needs a span. */
  startLine?: number;
  endLine?: number;
  /** A short unique snippet, used only to disambiguate. */
  near?: string;
}

export interface EditOperation {
  operationType: EditOperationType;
  targetFile: string;
  /** The declaration the operation acts on. */
  targetSymbol?: string;
  sourceLocation?: SourceLocation;
  parameters: Record<string, unknown>;
  /** What the model expects to be true before the edit; advisory. */
  expectedBefore?: string;
  /** What the model expects afterwards; advisory. */
  expectedAfter?: string;
  confidence?: number;
  reason?: string;
}

export interface EditPlan {
  operations: EditOperation[];
  affectedSymbols: string[];
  expectedValidation: string[];
  risks: string[];
}

export interface OperationResult {
  operation: EditOperation;
  applied: boolean;
  /** Repo-relative paths actually written. */
  changedFiles: string[];
  reason?: string;
  bytesBefore: number;
  bytesAfter: number;
  /** Lines added or removed, for budget accounting. */
  changedLines: number;
}

export type RejectionCode =
  | 'FILE_NOT_FOUND'
  | 'FILE_NOT_ALLOWED'
  | 'PATH_ESCAPE'
  | 'GENERATED_FILE'
  | 'SYMBOL_NOT_FOUND'
  | 'SYMBOL_AMBIGUOUS'
  | 'INVALID_PARAMETERS'
  | 'INVALID_RANGE'
  | 'UNSUPPORTED_OPERATION'
  | 'PARSE_FAILED'
  | 'NO_CHANGE'
  | 'UNRELATED_CHANGE';

export class EditOperationError extends Error {
  constructor(readonly code: RejectionCode, message: string, readonly detail?: unknown) {
    super(message);
    this.name = 'EditOperationError';
  }
}

/** JSON schema handed to the model for structured EditPlan output. */
export const EDIT_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    operations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          operationType: {
            type: 'string',
            enum: [
              'add_property_to_object',
              'rename_symbol',
              'update_function_return_type',
              'replace_expression',
              'insert_statement',
              'add_import',
              'remove_import',
              'update_route_response_field',
              'extract_function',
              'move_function',
            ],
          },
          targetFile: { type: 'string' },
          targetSymbol: { type: 'string' },
          sourceLocation: {
            type: 'object',
            properties: {
              symbol: { type: 'string' },
              startLine: { type: 'number' },
              endLine: { type: 'number' },
              near: { type: 'string' },
            },
          },
          parameters: { type: 'object' },
          confidence: { type: 'number' },
          reason: { type: 'string' },
        },
        required: ['operationType', 'targetFile', 'parameters', 'reason'],
      },
    },
    affectedSymbols: { type: 'array', items: { type: 'string' } },
    expectedValidation: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
  },
  required: ['operations'],
} as const;
