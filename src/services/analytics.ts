export type AppEvent = 'app_open' | 'onboarding_start' | 'onboarding_complete' | 'paywall_view' | 'purchase' | 'screen_view';
interface MinimalClient { capture: (event: string, props?: Record<string, unknown>) => void; }
export function createAnalytics(client: MinimalClient | null) {
  return { capture(event: AppEvent, props?: Record<string, unknown>) { client?.capture(event, props); } };
}
export type Analytics = ReturnType<typeof createAnalytics>;
