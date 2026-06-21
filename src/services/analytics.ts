// ──────────────────────────────────────────────────────────────────────────────
// analytics — the typed Whenbee funnel sink (PostHog, non-blocking, no PII).
//
// `AppEventProps` is the single contract: each event maps to its props shape, so
// `capture(event, props)` is type-checked at every call site. The full funnel
// from `06-RELEASE-AND-METRICS §2` lives here. `capture` is fire-and-forget and
// NEVER throws into a caller — the core loop must never break for analytics.
//
// Naming note: three pre-existing names are kept so live callers don't break and
// are treated as aliases of the §2 table:
//   • `app_open`            ≈ §2 `app_installed` (app launch; both retained)
//   • `onboarding_complete` ≈ §2 `onboarding_completed`
//   • `cell_capped`         (tier-cap haptic marker; `tier_up` is the §2 funnel name)
// New §2 names are ADDED alongside rather than renaming the working ones.
// ──────────────────────────────────────────────────────────────────────────────

/** Sharpness tier index/name as the engine reports it. */
type TierName = string;

/** Earned-Readiness confidence enum, mirrored locally so analytics stays
 *  dependency-free (cf. `TierName`). Matches `CalibrationConfidence`. */
type HonestRangeConfidence = 'raw' | 'setting' | 'honest';

/** Where a guess/timer/log originated. */
type EventSource = 'today' | 'fab' | 'addtask' | 'timed' | 'retro';

/** Hyperfocus guardrail multiple, mirrored locally (cf. `TierName`) so analytics
 *  stays dependency-free. Matches `GuardrailMultiple`. */
type GuardrailSetting = 'off' | '1.5x' | '2x' | '3x';

/** Map of every analytics event to its props shape (the type contract). */
export interface AppEventProps {
  // ── Lifecycle (kept; aliases of §2 app_installed / onboarding_completed) ──────
  app_open: Record<string, never>;
  app_installed: Record<string, never>;
  onboarding_start: Record<string, never>;
  onboarding_complete: { steps?: number };
  onboarding_completed: { categories_picked: number; custom_category_added: boolean };
  screen_view: { screen: string };

  // ── Core loop ────────────────────────────────────────────────────────────────
  task_started: { category: string; guess_min: number; source: EventSource };
  task_logged: {
    category: string;
    guess_min: number;
    actual_min: number;
    ratio: number;
    entry_type: 'timed' | 'retro';
    sharpness_after: number;
    tier_after: TierName;
    // Kept for back-compat with the existing call site / tests.
    status?: string;
    source?: string;
    counted?: boolean;
  };
  first_log: { time_since_install_sec: number };
  honey_ripened: { sharpness_before: number; sharpness_after: number; delta: number };
  tier_up: { from_tier: TierName; to_tier: TierName };
  cell_capped: { tier: TierName };
  aha_shown: { category: string; multiplier: number; n: number };
  discovery_unlocked: { categoryId: string; multiplier: number };

  // ── Decision-moment surfacing ────────────────────────────────────────────────
  honest_suggestion_shown: { category: string; guess_min: number; suggested_min: number };
  optimistic_nudge_shown: { category: string; guess_min: number; multiplier: number };

  // ── Overrun reason chips (kept) ──────────────────────────────────────────────
  overrun_reason_shown: { category: string; direction: 'over' | 'under' };
  overrun_reason_tagged: {
    category: string;
    direction: 'over' | 'under';
    reason: string;
    source: 'manual' | 'auto' | 'custom';
  };
  overrun_reason_skipped: { category: string; direction: 'over' | 'under' };

  // ── Start-By planner ─────────────────────────────────────────────────────────
  plan_built: { n_tasks: number; status: 'fits' | 'over'; freed_min: number };
  plan_cut_one: { n_tasks: number; status: 'fits' | 'over'; freed_min: number };
  plan_reprojected: { n_tasks: number; status: 'fits' | 'over'; freed_min: number };

  // ── Whenbee personalization ──────────────────────────────────────────────────
  whenbee_personalized: { attribute: string; skipped: boolean };

  // ── Native presence ──────────────────────────────────────────────────────────
  widget_added: { surface: 'home' | 'lock' | 'live_activity' };
  widget_engaged: { surface: 'home' | 'lock' | 'live_activity' };

  // ── Confidence band (honest range) ────────────────────────────────────────────
  honest_range_shown: {
    surface: 'add_task' | 'category_detail' | 'timer';
    confidence: HonestRangeConfidence; // 'raw' | 'setting' | 'honest'
    width_min: number; // high − low, bucketed to nearest 5
    is_pro: boolean;
  };
  honest_range_locked_tap: { surface: 'add_task' | 'category_detail' };
  honest_range_narrowed: { was_width_min: number; now_width_min: number };

  // ── Monetization ─────────────────────────────────────────────────────────────
  // Ripening Pro card impression events (WhenbeeHub, non-Pro path).
  ripening_pro_shown: { surface: 'whenbee_hub' };
  pro_reveal_shown: { surface: 'whenbee_hub' };
  // Ripening Pro card CTA taps.
  pro_reveal_tap: { surface: 'whenbee_hub' };
  pro_preview_tap: { surface: 'whenbee_hub' };
  paywall_view: {
    trigger: 'make_day_honest' | 'settings_upgrade' | 'steals_your_time' | 'honest_range' | 'pro_reveal' | 'pro_preview' | 'goals' | 'focus_window' | 'hyperfocus_guard' | 'pdf_export';
    readiness?: 'pre' | 'honest';
  };
  founder_reserve: { result: 'reserved' };
  plan_selected: { plan: 'yearly' | 'lifetime' | 'monthly' };
  trial_started: { plan: string; price: number; result: string };
  purchase: { plan: string; price: number; result: string };
  restore_purchases: { plan?: string; price?: number; result: string };
  manage_subscription: { source: 'settings' | 'paywall' };

  // ── On-device share ──────────────────────────────────────────────────────────
  plan_shared: { surface: 'plan' | 'archetype'; is_pro: boolean; result: 'shared' | 'gated' | 'error' };

  // ── PDF report export (Pro) ──────────────────────────────────────────────────
  report_opened: { is_pro: boolean };
  report_paywall: { trigger: 'pdf_export' };
  report_export: {
    window: '30d' | '90d' | 'all';
    category_count: number;
    total_logs: number;
    result: 'shared' | 'gated' | 'thin' | 'error';
  };

  // ── Calendar / reminders ─────────────────────────────────────────────────────
  calendar_padded: { events_count: number; day_end_shift_min: number };
  reminder_enabled: Record<string, never>;
  reminder_disabled: Record<string, never>;
  drift_recheck: { action: 'shown' | 'recheck' | 'dismissed' };
  context_tagged: { key: string; value: string };

  // ── Per-category goals (Pro) ──────────────────────────────────────────────────
  goal_card_viewed: { category: string; state: 'empty' | 'active' | 'met' | 'not_enough' | 'locked' };
  goal_set: { category: string; target_band: number; baseline_band: number };
  goal_paywall: { category: string };
  goal_met: { category: string; target_band: number; logs_to_meet: number };
  goal_replaced: { category: string; from_band: number; to_band: number };
  goal_kept: { category: string; band: number };

  // ── Hyperfocus guardrail (Pro) ────────────────────────────────────────────────
  guardrail_armed: { setting: GuardrailSetting; threshold_min: number; honest_min: number };
  guardrail_shown: { channel: 'in_app' | 'notification'; elapsed_min: number; threshold_min: number };
  guardrail_resolved: { action: 'keep_going' | 'wrap_up'; elapsed_min: number };
  guardrail_setting_changed: { from: GuardrailSetting; to: GuardrailSetting };
  guardrail_paywall: Record<string, never>;

  // ── Focus-window planner (Pro) ────────────────────────────────────────────────
  focus_window_viewed: { verdict: 'fits' | 'spills' | 'unset'; fit_count: number; total_count: number; window_min: number; is_pro: boolean };
  focus_window_set: { window_start_min: number; window_end_min: number; window_min: number };
  focus_window_spills: { fit_count: number; spill_count: number; window_min: number };
  focus_window_promoted: { saved_min: number; evicted_n: number; verdict_after: 'fits' | 'spills' };
  focus_window_paywall: { source: 'plan_section' };
}

export type AppEvent = keyof AppEventProps;

interface MinimalClient {
  capture: (event: string, props?: Record<string, unknown>) => void;
}

export function createAnalytics(client: MinimalClient | null) {
  return {
    capture<E extends AppEvent>(event: E, props?: AppEventProps[E]): void {
      client?.capture(event, props);
    },
  };
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
  capture<E extends AppEvent>(event: E, props?: AppEventProps[E]): void {
    try {
      sink.capture(event, props);
    } catch {
      // analytics is fire-and-forget; never throw into callers
    }
  },
};
