import { buildReportModel, type ReportEventRow } from '../useReportModel';
import { sharpnessFromWindow, clampRatio } from '@/src/engine';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_000_000_000_000;

function row(p: Partial<ReportEventRow>): ReportEventRow {
  return {
    category: 'admin',
    label: null,
    estimateMin: 10,
    actualMin: 12,
    status: 'completed',
    endedAt: NOW - DAY,
    ...p,
  };
}

const nameOf = (id: string) => (id === 'admin' ? 'Admin & email' : id);

describe('buildReportModel', () => {
  it('reports thin status when the window has fewer than REPORT_MIN_LOGS completed logs', () => {
    const events: ReportEventRow[] = [row({}), row({}), row({})];
    const { model, status } = buildReportModel({
      windowKind: '30d',
      nowMs: NOW,
      events,
      statsByCategory: {},
      companionName: null,
      nameOf,
    });
    expect(status).toBe('thin');
    expect(model).toBeNull();
  });

  it('accuracyPct matches sharpnessFromWindow over the windowed clamped ratios', () => {
    const events: ReportEventRow[] = Array.from({ length: 8 }, (_, i) =>
      row({ estimateMin: 10, actualMin: 10 + i, endedAt: NOW - i * DAY }),
    );
    const ratios = events.map((e) => clampRatio(e.estimateMin, e.actualMin as number));
    const { model, status } = buildReportModel({
      windowKind: 'all',
      nowMs: NOW,
      events,
      statsByCategory: { admin: { n: 8, mEffective: 1.4 } },
      companionName: null,
      nameOf,
    });
    expect(status).toBe('ready');
    expect(model?.accuracyPct).toBe(sharpnessFromWindow(ratios));
    expect(model?.totalLogs).toBe(8);
  });

  it('omits categories below the per-row minimum and counts them', () => {
    const enough: ReportEventRow[] = Array.from({ length: 6 }, (_, i) =>
      row({ category: 'admin', estimateMin: 10, actualMin: 12, endedAt: NOW - i * DAY }),
    );
    const tooFew: ReportEventRow[] = Array.from({ length: 2 }, (_, i) =>
      row({ category: 'writing', estimateMin: 10, actualMin: 30, endedAt: NOW - i * DAY }),
    );
    const { model } = buildReportModel({
      windowKind: 'all',
      nowMs: NOW,
      events: [...enough, ...tooFew],
      statsByCategory: {
        admin: { n: 6, mEffective: 1.2 },
        writing: { n: 2, mEffective: 3 },
      },
      companionName: null,
      nameOf,
    });
    expect(model?.categories.map((c) => c.categoryId)).toEqual(['admin']);
    expect(model?.omittedCategoryCount).toBe(1);
  });

  it('filters events outside the window', () => {
    const inWindow: ReportEventRow[] = Array.from({ length: 6 }, (_, i) =>
      row({ estimateMin: 10, actualMin: 12, endedAt: NOW - i * DAY }),
    );
    const old: ReportEventRow[] = Array.from({ length: 6 }, (_, i) =>
      row({ estimateMin: 10, actualMin: 12, endedAt: NOW - (40 + i) * DAY }),
    );
    const { model } = buildReportModel({
      windowKind: '30d',
      nowMs: NOW,
      events: [...inWindow, ...old],
      statsByCategory: { admin: { n: 12, mEffective: 1.2 } },
      companionName: null,
      nameOf,
    });
    expect(model?.totalLogs).toBe(6);
  });

  it('carries the companion name through when set', () => {
    const events: ReportEventRow[] = Array.from({ length: 6 }, (_, i) =>
      row({ endedAt: NOW - i * DAY }),
    );
    const { model } = buildReportModel({
      windowKind: 'all',
      nowMs: NOW,
      events,
      statsByCategory: { admin: { n: 6, mEffective: 1.2 } },
      companionName: 'Buzz',
      nameOf,
    });
    expect(model?.companionName).toBe('Buzz');
  });

  it('produces a model with no reclaim / time-saved field', () => {
    const events: ReportEventRow[] = Array.from({ length: 6 }, (_, i) =>
      row({ endedAt: NOW - i * DAY }),
    );
    const { model } = buildReportModel({
      windowKind: 'all',
      nowMs: NOW,
      events,
      statsByCategory: { admin: { n: 6, mEffective: 1.2 } },
      companionName: null,
      nameOf,
    });
    const keys = Object.keys(model ?? {});
    expect(keys.some((k) => /reclaim|saved/i.test(k))).toBe(false);
  });
});
