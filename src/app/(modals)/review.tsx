import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { ReviewModal } from '@/src/features/review/ReviewModal';

// Thin route: Pro-only. A non-Pro deep-link (e.g. a stale notification) replaces
// itself with the paywall so the back stack lands on Patterns, not an empty modal.
// All logic — the review_opened/completed analytics — lives in the feature.
type ReviewSource = 'card' | 'notification' | 'manual';

function asSource(v: unknown): ReviewSource {
  return v === 'notification' || v === 'manual' ? v : 'card';
}

export default function ReviewRoute() {
  const isPro = useEntitlement((s) => s.isPro);
  const { source } = useLocalSearchParams<{ source?: string }>();

  useEffect(() => {
    if (!isPro) router.replace({ pathname: '/(modals)/paywall', params: { trigger: 'review_ritual' } });
  }, [isPro]);

  if (!isPro) return null;
  return <ReviewModal source={asSource(source)} />;
}
