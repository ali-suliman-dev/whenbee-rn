import { useLocalSearchParams } from 'expo-router';
import { ProWelcome } from '@/src/features/paywall/ProWelcome';

// ──────────────────────────────────────────────────────────────────────────────
// Pro-welcome route (fullScreenModal) — thin. The paywall replaces itself with
// this screen after a successful purchase or restore. `plan` labels the rows
// (yearly/monthly get the trial + reminder rows; lifetime/restore don't);
// `purchasedAt` (ISO) anchors the Day-5/Day-7 dates.
// ──────────────────────────────────────────────────────────────────────────────

export default function ProWelcomeRoute() {
  const { plan, purchasedAt } = useLocalSearchParams<{ plan?: string; purchasedAt?: string }>();
  return <ProWelcome plan={plan ?? 'yearly'} purchasedAt={purchasedAt ?? ''} />;
}
