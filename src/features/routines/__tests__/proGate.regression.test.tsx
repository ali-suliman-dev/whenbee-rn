/**
 * Pro-gate regression tests — Task D1
 *
 * 1. Free users see RoutinesLocked teaser, NOT the routines list or build/run UI.
 * 2. Scheduled-routine day blocks never render for free users (gate invariant).
 * 3. Pro users see the routines list.
 *
 * Strategy: store-level + render tests. RoutinesScreen wraps with ProGate.
 * The scheduled-block gate in index.tsx is tested as a pure logic invariant
 * (the Today screen test suite covers the full screen render path).
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useRoutinesStore } from '@/src/stores/routinesStore';
import { createMemoryDatabase } from '@/src/db';
import { RoutinesScreen } from '../RoutinesScreen';

// ── Mocks (hoisted by babel-jest) ────────────────────────────────────────────

jest.mock('@/src/services/analytics', () => ({
  analytics: { capture: jest.fn() },
}));

jest.mock('@/src/services/routineNotifications', () => ({
  scheduleRoutineAlerts: jest.fn(() => Promise.resolve()),
  cancelRoutineAlerts: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/src/services/liveActivity', () => ({
  startFinishTimeActivity: jest.fn(),
  endFinishTimeActivity: jest.fn(),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetRoutinesStore() {
  const db = createMemoryDatabase();
  useRoutinesStore.setState({
    db,
    routines: [],
    stepMByKey: {},
    activeRun: null,
    draft: {
      editingId: null,
      name: '',
      doneByMinuteOfDay: null,
      steps: [],
      scheduleDays: [],
      alertEnabled: false,
      alertLeadMin: 0,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe('RoutinesScreen — Pro gate', () => {
  beforeEach(() => {
    resetRoutinesStore();
  });

  it('shows RoutinesLocked for a free user', () => {
    useEntitlement.setState({ isPro: false, ready: true });
    render(<RoutinesScreen />);
    // RoutinesLocked renders the paywall CTA
    expect(screen.getByText('See Whenbee Pro')).toBeTruthy();
  });

  it('does NOT show the routines list for a free user', () => {
    useEntitlement.setState({ isPro: false, ready: true });
    render(<RoutinesScreen />);
    // The routines list behavior-framed empty-state copy must NOT appear
    expect(
      screen.queryByText(/guided sequence that runs on a timer/i),
    ).toBeNull();
  });

  it('does NOT show the New routine button for a free user', () => {
    useEntitlement.setState({ isPro: false, ready: true });
    render(<RoutinesScreen />);
    expect(screen.queryByText('New routine')).toBeNull();
  });

  it('shows the routines list empty state for a Pro user', () => {
    useEntitlement.setState({ isPro: true, ready: true });
    render(<RoutinesScreen />);
    // Pro empty state shows the behavior-framed description
    expect(
      screen.getByText(/guided sequence that runs on a timer/i),
    ).toBeTruthy();
  });

  it('shows the New routine button for a Pro user', () => {
    useEntitlement.setState({ isPro: true, ready: true });
    render(<RoutinesScreen />);
    expect(screen.getByText('New routine')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NOTE: The real render gate test lives in:
//   src/features/today/__tests__/scheduledRoutineGate.test.tsx
// That file renders ScheduledRoutineBlock inside the same gate condition used in
// index.tsx and asserts DOM presence/absence for free vs Pro users.
