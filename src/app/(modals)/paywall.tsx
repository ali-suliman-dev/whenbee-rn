import { useLocalSearchParams } from 'expo-router';
import { Paywall } from '@/src/features/paywall/Paywall';

// ──────────────────────────────────────────────────────────────────────────────
// Paywall route (formSheet) — thin. All composition + logic lives in the feature
// component. Reads the `trigger` param (make_day_honest | settings_upgrade) and
// hands it to <Paywall/>, which fires paywall_view on mount.
// ──────────────────────────────────────────────────────────────────────────────

export default function PaywallRoute() {
  const { trigger } = useLocalSearchParams<{ trigger?: string }>();
  return <Paywall trigger={trigger} />;
}
