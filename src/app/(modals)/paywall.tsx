import { useLocalSearchParams } from 'expo-router';
import { Paywall } from '@/src/features/paywall/Paywall';

// ──────────────────────────────────────────────────────────────────────────────
// Paywall route (formSheet) — thin. All composition + logic lives in the feature
// component. Reads the `trigger` param (make_day_honest | settings_upgrade) and
// the `readiness` param (pre | honest), then hands both to <Paywall/>, which
// fires paywall_view on mount. `readiness=honest` swaps the lead to the earned
// framing; anything else keeps the default "pre" framing.
// ──────────────────────────────────────────────────────────────────────────────

export default function PaywallRoute() {
  const { trigger, readiness } = useLocalSearchParams<{ trigger?: string; readiness?: string }>();
  return <Paywall trigger={trigger} readiness={readiness === 'honest' ? 'honest' : 'pre'} />;
}
