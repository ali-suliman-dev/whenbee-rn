import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { ReportBuilder } from '@/src/features/report/ReportBuilder';
import { ReportLockedTeaser } from '@/src/features/report/ReportLockedTeaser';

// Thin route: branch on the Pro entitlement. All logic — including the
// `report_opened` analytics on mount — lives in the feature components.
export default function ReportModal() {
  const isPro = useEntitlement((s) => s.isPro);
  return isPro ? <ReportBuilder /> : <ReportLockedTeaser />;
}
