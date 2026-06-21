import { runExportFlow, type ExportFlowDeps } from '../useReportExport';

function baseDeps(overrides: Partial<ExportFlowDeps> = {}): ExportFlowDeps {
  return {
    isPro: true,
    status: 'ready',
    window: '30d',
    categoryCount: 2,
    totalLogs: 24,
    buildHtml: () => '<html></html>',
    print: jest.fn(async () => 'shared' as const),
    openPaywall: jest.fn(),
    capture: jest.fn(),
    ...overrides,
  };
}

describe('runExportFlow', () => {
  it('non-Pro → captures gated, opens the paywall, never prints', async () => {
    const print = jest.fn(async () => 'shared' as const);
    const openPaywall = jest.fn();
    const capture = jest.fn();
    const outcome = await runExportFlow(baseDeps({ isPro: false, print, openPaywall, capture }));
    expect(outcome).toBe('gated');
    expect(openPaywall).toHaveBeenCalledTimes(1);
    expect(print).not.toHaveBeenCalled();
    expect(capture).toHaveBeenCalledWith('report_export', expect.objectContaining({ result: 'gated' }));
  });

  it('thin status → no-op, never prints, returns thin', async () => {
    const print = jest.fn(async () => 'shared' as const);
    const outcome = await runExportFlow(baseDeps({ status: 'thin', print }));
    expect(outcome).toBe('thin');
    expect(print).not.toHaveBeenCalled();
  });

  it('Pro + ready + print shared → shared, captures the outcome', async () => {
    const print = jest.fn(async () => 'shared' as const);
    const capture = jest.fn();
    const outcome = await runExportFlow(baseDeps({ print, capture }));
    expect(outcome).toBe('shared');
    expect(print).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(
      'report_export',
      expect.objectContaining({ result: 'shared', window: '30d', category_count: 2, total_logs: 24 }),
    );
  });

  it('print error → error (swallowed), never throws', async () => {
    const print = jest.fn(async () => 'error' as const);
    const outcome = await runExportFlow(baseDeps({ print }));
    expect(outcome).toBe('error');
  });

  it('print unavailable folds to error', async () => {
    const print = jest.fn(async () => 'unavailable' as const);
    const outcome = await runExportFlow(baseDeps({ print }));
    expect(outcome).toBe('error');
  });

  it('a thrown print never escapes — folds to error', async () => {
    const print = jest.fn(async () => {
      throw new Error('boom');
    });
    const outcome = await runExportFlow(baseDeps({ print }));
    expect(outcome).toBe('error');
  });
});
