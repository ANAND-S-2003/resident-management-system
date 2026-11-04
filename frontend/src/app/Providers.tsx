import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { shouldRetryQuery } from '@/lib/query-retry';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: shouldRetryQuery, refetchOnWindowFocus: false } } }));
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
