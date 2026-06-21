import { useCallback } from 'react';
import { router } from 'expo-router';
import { analytics } from '@/src/services/analytics';
import { getPrint, type PrintResult } from '@/src/services/print';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import type { ReportModel, ReportStatus, ReportWindow } from './reportModel';
import { buildReportHtml } from './buildReportHtml';

// ──────────────────────────────────────────────────────────────────────────────
// useReportExport — orchestrates the on-device PDF export. `runExportFlow` is the
// PURE, fully-injectable core (no native, no router, no store) so it unit-tests
// cleanly, mirroring `runShareFlow`:
//   • non-Pro → log 'gated' + open the paywall; never print.
//   • thin    → no-op 'thin' (the button is disabled, but we guard anyway).
//   • Pro+ready → build HTML → print + share on-device → log the outcome. Any
//                 failure is swallowed to 'error'; the flow never throws.
//
// PRIVACY INVARIANT: the report renders locally and its file URI goes straight to
// the OS share sheet — no upload, no account, no network (mirrors print.ts).
// ──────────────────────────────────────────────────────────────────────────────

export type ExportOutcome = 'shared' | 'gated' | 'thin' | 'error';

export interface ExportFlowDeps {
  isPro: boolean;
  status: ReportStatus;
  window: ReportWindow['kind'];
  categoryCount: number;
  totalLogs: number;
  buildHtml: () => string;
  print: (html: string) => Promise<PrintResult>;
  openPaywall: () => void;
  capture: (
    event: 'report_export',
    props: {
      window: ReportWindow['kind'];
      category_count: number;
      total_logs: number;
      result: ExportOutcome;
    },
  ) => void;
}

/** Fold a native print result into the analytics outcome (unavailable → error). */
function toOutcome(result: PrintResult): ExportOutcome {
  return result === 'shared' ? 'shared' : 'error';
}

export async function runExportFlow(deps: ExportFlowDeps): Promise<ExportOutcome> {
  const { isPro, status, window, categoryCount, totalLogs, buildHtml, print, openPaywall, capture } =
    deps;

  const record = (result: ExportOutcome): ExportOutcome => {
    capture('report_export', {
      window,
      category_count: categoryCount,
      total_logs: totalLogs,
      result,
    });
    return result;
  };

  if (!isPro) {
    openPaywall();
    return record('gated');
  }

  if (status !== 'ready') {
    return 'thin';
  }

  try {
    const result = await print(buildHtml());
    return record(toOutcome(result));
  } catch {
    return record('error');
  }
}

export interface UseReportExportArgs {
  model: ReportModel | null;
  status: ReportStatus;
  css: string;
}

/** Hook wrapper: wires the pure flow to the real entitlement, print service,
 *  router, and analytics. Returns the outcome so the screen can show its state. */
export function useReportExport({ model, status, css }: UseReportExportArgs): () => Promise<ExportOutcome> {
  const isPro = useEntitlement((s) => s.isPro);

  return useCallback(
    () =>
      runExportFlow({
        isPro,
        status,
        window: model?.window.kind ?? 'all',
        categoryCount: model?.categoryCount ?? 0,
        totalLogs: model?.totalLogs ?? 0,
        buildHtml: () => (model ? buildReportHtml(model, css) : ''),
        print: (html) => getPrint().printAndShare(html),
        openPaywall: () =>
          router.push({ pathname: '/(modals)/paywall', params: { trigger: 'pdf_export' } }),
        capture: analytics.capture,
      }),
    [isPro, status, model, css],
  );
}
