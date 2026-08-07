import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { EndOfDayReview, WeeklyOperatingReview } from '@/lib/types';
import { DataBoundary } from '@/components/States';
import { CategoryList } from '@/components/CategoryList';

function todayIso(): string { return new Date().toISOString().slice(0, 10); }

export function ReviewsPage() {
  const [tab, setTab] = useState<'Daily' | 'Weekly'>('Daily');
  const [date, setDate] = useState(todayIso());
  const queryClient = useQueryClient();

  const review = useQuery({
    queryKey: ['operating', 'review', date],
    queryFn: () => api.get<EndOfDayReview>(`/operating/today/review?date=${date}`),
    retry: false,
    enabled: tab === 'Daily',
  });
  const weekly = useQuery({
    queryKey: ['operating', 'week'],
    queryFn: () => api.get<WeeklyOperatingReview>('/operating/week'),
    retry: false,
    enabled: tab === 'Weekly',
  });

  const generateDaily = useMutation({
    mutationFn: () => api.post<EndOfDayReview>('/operating/today/review/generate', { date }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operating', 'review', date] }),
  });
  const generateWeekly = useMutation({
    mutationFn: () => api.post<WeeklyOperatingReview>('/operating/week/generate'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operating', 'week'] }),
  });

  const dailyNotFound = review.error && (review.error as { status?: number }).status === 404;
  const weeklyNotFound = weekly.error && (weekly.error as { status?: number }).status === 404;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-xl font-semibold text-(--color-text)">Reviews</h1>
      <div className="mb-4 flex gap-1 border-b border-(--color-border)">
        {(['Daily', 'Weekly'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`border-b-2 px-3 py-2 text-sm ${tab === t ? 'border-(--color-accent) text-(--color-accent)' : 'border-transparent text-(--color-text-dim) hover:text-(--color-text)'}`}>{t}</button>
        ))}
      </div>

      {tab === 'Daily' && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <label htmlFor="review-date" className="text-sm text-(--color-text-dim)">Date</label>
            <input id="review-date" type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-md border border-(--color-border) bg-(--color-surface) px-2 py-1 text-sm" />
          </div>
          {dailyNotFound ? (
            <div className="rounded-lg border border-dashed border-(--color-border) p-6 text-center">
              <p className="mb-3 text-sm text-(--color-text-dim)">No end-of-day review for {date}.</p>
              {date === todayIso() && (
                <button onClick={() => generateDaily.mutate()} disabled={generateDaily.isPending} className="rounded-md bg-(--color-accent) px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
                  {generateDaily.isPending ? 'Generating…' : 'Generate today\'s review'}
                </button>
              )}
            </div>
          ) : (
            <DataBoundary isLoading={review.isLoading} error={dailyNotFound ? null : review.error}>
              {review.data && <DailyReviewView review={review.data} />}
            </DataBoundary>
          )}
        </div>
      )}

      {tab === 'Weekly' && (
        weeklyNotFound ? (
          <div className="rounded-lg border border-dashed border-(--color-border) p-6 text-center">
            <p className="mb-3 text-sm text-(--color-text-dim)">No weekly operating review for this week yet.</p>
            <button onClick={() => generateWeekly.mutate()} disabled={generateWeekly.isPending} className="rounded-md bg-(--color-accent) px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              {generateWeekly.isPending ? 'Generating…' : 'Generate weekly review'}
            </button>
          </div>
        ) : (
          <DataBoundary isLoading={weekly.isLoading} error={weeklyNotFound ? null : weekly.error}>
            {weekly.data && <WeeklyReviewView review={weekly.data} />}
          </DataBoundary>
        )
      )}
    </div>
  );
}

function DailyReviewView({ review }: { review: EndOfDayReview }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <Stat label="Completed" value={review.completedItems.length} />
        <Stat label="Failed" value={review.failedItems.length} />
        <Stat label="Blocked" value={review.blockedItems.length} />
      </div>
      <CategoryList kind="fact" items={review.facts} />
      {review.lessons.length > 0 && <CategoryList kind="suggestion" title="LESSONS" items={review.lessons} />}
      {review.recurringIssues.length > 0 && <CategoryList kind="unknown" title="RECURRING ISSUES" items={review.recurringIssues} />}
      <CategoryList kind="suggestion" items={review.tomorrowSuggestions} title="TOMORROW" />
      <CategoryList kind="unknown" items={review.unknowns} />
    </div>
  );
}

function WeeklyReviewView({ review }: { review: WeeklyOperatingReview }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-(--color-text-dim)">{review.weekStart} → {review.weekEnd}</p>
      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <Stat label="Completed" value={review.completedTasks} />
        <Stat label="Failed" value={review.failedTasks} />
        <Stat label="Blocked" value={review.blockedTasks} />
      </div>
      <CategoryList kind="fact" items={review.facts} />
      {review.lessons.length > 0 && <CategoryList kind="suggestion" title="LESSONS" items={review.lessons} />}
      {review.recurringIssues.length > 0 && <CategoryList kind="unknown" title="RECURRING ISSUES" items={review.recurringIssues} />}
      <CategoryList kind="suggestion" items={review.suggestedNextWeekPriorities} title="NEXT WEEK" />
      <CategoryList kind="unknown" items={review.unknowns} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-(--color-border) p-3">
      <p className="text-lg font-semibold text-(--color-text)">{value}</p>
      <p className="text-xs text-(--color-text-faint)">{label}</p>
    </div>
  );
}
