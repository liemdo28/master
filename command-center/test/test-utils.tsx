import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { EvidenceProvider } from '@/components/EvidenceDrawer';

export function renderWithProviders(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <EvidenceProvider>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </EvidenceProvider>
    </QueryClientProvider>,
  );
}
