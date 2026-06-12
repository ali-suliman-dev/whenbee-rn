export type AppEvent =
  | 'app_open'
  | 'onboarding_start'
  | 'onboarding_complete'
  | 'paywall_view'
  | 'purchase'
  | 'screen_view'
  | 'task_logged'
  | 'cell_capped'
  | 'reclaim_deposit';
interface MinimalClient { capture: (event: string, props?: Record<string, unknown>) => void; }
export function createAnalytics(client: MinimalClient | null) {
  return { capture(event: AppEvent, props?: Record<string, unknown>) { client?.capture(event, props); } };
}
export type Analytics = ReturnType<typeof createAnalytics>;

// Module-level sink so non-React layers (stores) can emit analytics without a
// React context. A provider calls `setAnalyticsSink` once the PostHog client is
// available; until then `analytics.capture` is a safe no-op.
let sink: Analytics = createAnalytics(null);
export function setAnalyticsSink(client: MinimalClient | null): void {
  sink = createAnalytics(client);
}
export const analytics = {
  capture(event: AppEvent, props?: Record<string, unknown>) {
    try {
      sink.capture(event, props);
    } catch {
      // analytics is fire-and-forget; never throw into callers
    }
  },
};
