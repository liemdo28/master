// ============================================================
// Agent OS - Control Plane - Intent Engine
// Converts natural language commands into structured task objects
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { TaskType, TaskPriority } from '../types';

export interface ParsedIntent {
  supported: boolean;
  intent: string;
  displayName?: string;
  type: TaskType | 'query';
  executor?: string;
  project: string;
  priority: TaskPriority;
  payload: Record<string, unknown>;
  requiresApproval: boolean;
  riskLevel: 'safe' | 'elevated' | 'dangerous' | 'critical';
  originalMessage: string;
  unsupportedReason?: string;
  suggestions?: string[];
}

type RiskLevel = ParsedIntent['riskLevel'];

interface CommandDefinition {
  intent: string;
  display_name: string;
  task_type: string;
  executor: string;
  project: string;
  risk_level: RiskLevel;
  approval_required: boolean;
  aliases: string[];
  payload?: Record<string, unknown>;
}

interface CommandRegistry {
  commands: CommandDefinition[];
  unsupported_suggestions: string[];
}

function getRegistryPath(): string {
  const candidates = [
    path.resolve(process.cwd(), '..', 'COMMAND_REGISTRY.json'),
    path.resolve(process.cwd(), 'COMMAND_REGISTRY.json'),
    path.resolve(__dirname, '..', '..', '..', 'COMMAND_REGISTRY.json'),
  ];
  const found = candidates.find(candidate => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`COMMAND_REGISTRY.json not found. Checked: ${candidates.join(', ')}`);
  }
  return found;
}

function loadRegistry(): CommandRegistry {
  const raw = fs.readFileSync(getRegistryPath(), 'utf-8');
  return JSON.parse(raw) as CommandRegistry;
}

function normalizeMessage(message: string): string {
  return message.trim().toLowerCase().replace(/\s+/g, ' ');
}

function toTaskType(taskType: string): TaskType | 'query' {
  if (taskType === 'query') return 'query';
  if (Object.values(TaskType).includes(taskType as TaskType)) return taskType as TaskType;
  throw new Error(`Unsupported task_type in command registry: ${taskType}`);
}

/**
 * Parse a natural language message into a structured intent
 */
export function parseIntent(message: string): ParsedIntent {
  const trimmed = message.trim();
  const normalized = normalizeMessage(trimmed);
  const registry = loadRegistry();
  const command = registry.commands.find(entry =>
    entry.aliases.some(alias => normalizeMessage(alias) === normalized)
  );

  if (!command) {
    return {
      supported: false,
      intent: 'unsupported',
      type: 'query',
      project: 'E:\\Project\\Master',
      priority: extractPriority(normalized),
      payload: { originalMessage: trimmed },
      requiresApproval: false,
      riskLevel: 'safe',
      originalMessage: trimmed,
      unsupportedReason: 'Message did not match COMMAND_REGISTRY.json.',
      suggestions: registry.unsupported_suggestions,
    };
  }

  const type = toTaskType(command.task_type);
  const payload: Record<string, unknown> = {
    ...(command.payload || {}),
    registryIntent: command.intent,
    executor: command.executor,
    originalMessage: trimmed,
  };

  return {
    supported: true,
    intent: command.intent,
    displayName: command.display_name,
    type,
    executor: command.executor,
    project: command.project,
    priority: extractPriority(normalized),
    payload,
    requiresApproval: command.approval_required,
    riskLevel: command.risk_level,
    originalMessage: trimmed,
  };
}

/**
 * Extract priority from message context
 */
function extractPriority(message: string): TaskPriority {
  if (/urgent|asap|immediately|critical|now/i.test(message)) return TaskPriority.CRITICAL;
  if (/high|important|priority/i.test(message)) return TaskPriority.HIGH;
  if (/low|when.*free|later/i.test(message)) return TaskPriority.LOW;
  return TaskPriority.MEDIUM;
}

/**
 * Get a human-readable description of the parsed intent
 */
export function describeIntent(intent: ParsedIntent): string {
  if (!intent.supported) return 'Unsupported command';

  const riskEmoji = {
    safe: '✅',
    elevated: '⚠️',
    dangerous: '🔴',
    critical: '⛔',
  };

  return `${riskEmoji[intent.riskLevel]} ${intent.displayName || intent.intent} -> ${intent.executor} -> ${intent.project}${intent.requiresApproval ? ' (requires approval)' : ''}`;
}

export function getUnsupportedCommandMessage(suggestions?: string[]): string {
  const list = suggestions && suggestions.length > 0
    ? suggestions
    : loadRegistry().unsupported_suggestions;
  return [
    'I received your message, but it is not a supported command yet.',
    '',
    'Try:',
    ...list.map(item => `- ${item}`),
  ].join('\n');
}
