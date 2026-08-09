import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds default
      gcTime: 1000 * 60 * 15, // 15 minutes garbage collection
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export const QUERY_STALE_TIMES = {
  REALTIME_TRIPS: 2000, // 2s live updates
  SAFETY_ALERTS: 3000, // 3s live alerts
  VEHICLES_AND_DRIVERS: 15000, // 15s
  SACCOS_AND_AUTHORITIES: 60000, // 1m
  ANALYTICS_SUMMARIES: 1000 * 60 * 5, // 5m
  REMOTE_CONFIG: 1000 * 60 * 30, // 30m
};
