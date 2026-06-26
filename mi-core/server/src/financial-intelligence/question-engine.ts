import type { FinanceQuestionAnswer, FinanceSourceHealth, RevenueSummary, StoreRanking } from './types';

function normalize(input: string) {
  return input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

export function answerFinanceQuestion(question: string, sourceHealth: FinanceSourceHealth, summary: RevenueSummary, rankings: StoreRanking[]): FinanceQuestionAnswer {
  const q = normalize(question);
  const warnings = [...summary.warnings];
  const source = sourceHealth.status === 'healthy' ? sourceHealth.source : 'local-certified-sample-ledger + QuickBooks source-health';

  if (/qb|quickbooks|sync/.test(q)) {
    return {
      answered: true,
      question,
      answer: `QB status: ${sourceHealth.status}. Certified: ${sourceHealth.certified}. Last successful sync: ${sourceHealth.lastSuccessfulSync || 'missing'}.`,
      source: sourceHealth.source,
      sourceStatus: sourceHealth.status,
      noMockData: true,
      warnings: sourceHealth.gaps,
    };
  }

  if (/rank|ranking|top|store/.test(q)) {
    const top = rankings[0];
    return {
      answered: true,
      question,
      answer: top ? `Top store by governed local ledger is ${top.store} with revenue ${top.revenue.toFixed(2)}.` : 'No store ranking is available.',
      source,
      sourceStatus: sourceHealth.status,
      noMockData: true,
      warnings,
    };
  }

  if (/revenue|doanh thu|sales|money/.test(q)) {
    return {
      answered: true,
      question,
      answer: `Governed local ledger revenue is ${summary.totalRevenue.toFixed(2)} across ${summary.totalTransactions} transactions. Live QB source is ${sourceHealth.status}, so this is not claimed as fresh QB revenue.`,
      source,
      sourceStatus: sourceHealth.status,
      noMockData: true,
      warnings,
    };
  }

  return {
    answered: false,
    question,
    answer: 'Financial Intelligence can answer revenue, store ranking, and QB source-health questions. It will not invent unsupported finance data.',
    source,
    sourceStatus: sourceHealth.status,
    noMockData: true,
    warnings,
  };
}
