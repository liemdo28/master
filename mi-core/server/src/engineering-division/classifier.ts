import type { TaskClassification } from './types';

const repoMap: Array<[RegExp, string]> = [
  [/dashboard|approval|bill|task|laravel|php/i, 'D:\\Project\\Master\\Bakudan\\dashboard.bakudanramen.com'],
  [/mi|whatsapp|node|api|quickbooks|qb/i, 'D:\\Project\\Master\\mi-core'],
  [/python|analytics|sql|report/i, 'D:\\Project\\Master\\mi-core'],
];

export function classifyEngineeringTask(input: string): TaskClassification {
  const text = input.toLowerCase();
  const language = text.includes('laravel') || text.includes('php') || text.includes('dashboard') ? 'php'
    : text.includes('python') ? 'python'
      : text.includes('sql') ? 'sql'
        : 'typescript';

  const framework = language === 'php' ? 'laravel'
    : language === 'python' ? 'fastapi'
      : language === 'sql' ? 'postgres'
        : text.includes('react') ? 'react'
          : 'nodejs';

  const repo = (repoMap.find(([pattern]) => pattern.test(input)) || repoMap[1])[1];
  const isProduction = /production|deploy|approval|payment|quickbooks|payroll|credential|security|database|db/i.test(input);
  const isCritical = /payment|payroll|credential|security|quickbooks/i.test(input);
  const isLarge = /large|audit|refactor|migration|architecture/i.test(input);

  return {
    domain: text.includes('dashboard') ? 'dashboard'
      : text.includes('quickbooks') || text.includes('qb') ? 'quickbooks'
        : text.includes('analytics') ? 'analytics'
          : 'engineering',
    language,
    framework,
    repo,
    risk: isCritical ? 'critical' : isProduction ? 'high' : isLarge ? 'medium' : 'low',
    complexity: isLarge ? 'high' : /fix|bug|approval|workflow/i.test(input) ? 'medium' : 'low',
    productionImpact: isCritical ? 'critical' : isProduction ? 'high' : 'low',
  };
}
