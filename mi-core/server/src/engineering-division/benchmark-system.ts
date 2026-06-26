import { getEngineeringTasks } from './engineering-queue';
import type { CodingProvider } from './types';

const PROVIDERS: CodingProvider[] = ['qwen', 'deepseek', 'claude', 'gpt', 'kimi', 'human'];

export function modelScorecard() {
  const tasks = getEngineeringTasks();
  return PROVIDERS.map((provider) => {
    const owned = tasks.filter((t) => t.model === provider);
    const done = owned.filter((t) => t.status === 'DONE' || t.status === 'PR_READY').length;
    const reviewScores = owned.map((t) => t.review?.score).filter((s): s is number => typeof s === 'number');
    const passRate = owned.length ? Math.round((done / owned.length) * 100) : 0;
    return {
      provider,
      speed: 'not-measured',
      quality: reviewScores.length ? Math.round(reviewScores.reduce((a, b) => a + b, 0) / reviewScores.length) : 0,
      bugs: owned.filter((t) => t.status === 'FAILED').length,
      cost: 'tracked-in-model-registry',
      passRate,
      reviewScore: reviewScores.length ? Math.round(reviewScores.reduce((a, b) => a + b, 0) / reviewScores.length) : 0,
    };
  });
}

export const MODEL_SCORECARD = 'MODEL_SCORECARD';
