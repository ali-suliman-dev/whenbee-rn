import i18n from '@/src/i18n';
import { buildReportHtml } from '../buildReportHtml';
import { buildReportCss } from '../reportCss';
import type { ReportModel } from '../reportModel';

const palette = {
  ink: '#20233A',
  inkSoft: '#5C5F73',
  inkFaint: '#9B9DAB',
  primary: '#6B5BE6',
  primaryEdge: '#463B9E',
  surface: '#FFFFFF',
  hairline: '#DAD5C9',
  border: '#CFC9BA',
};
const css = buildReportCss(palette);

function model(overrides: Partial<ReportModel> = {}): ReportModel {
  return {
    window: { kind: '30d', sinceMs: 0, label: 'Last 30 days' },
    generatedAtMs: Date.UTC(2026, 5, 21), // 21 June 2026
    companionName: null,
    accuracyPct: 72,
    accuracySpark: [60, 64, 68, 70, 71, 72],
    totalLogs: 24,
    categoryCount: 1,
    steadiestCategoryName: null,
    categories: [
      {
        categoryId: 'admin',
        categoryName: 'Admin & email',
        logs: 9,
        typicalGuessMin: 15,
        honestMin: 20,
        range: null,
        multiplier: 1.3,
      },
    ],
    surprises: [],
    sharpestNote: null,
    omittedCategoryCount: 0,
    ...overrides,
  };
}

describe('buildReportHtml — locale threading', () => {
  afterEach(async () => {
    // Never leak the language switch into other test files sharing this i18n
    // singleton within the same Jest worker.
    await i18n.changeLanguage('en');
  });

  it('renders a Swedish month name and Swedish labels when the app language is sv', async () => {
    await i18n.changeLanguage('sv');

    const html = buildReportHtml(model(), css);

    // Intl-derived month name for June in sv-SE, not the hardcoded English array.
    expect(html).toContain('juni');
    // A handful of report labels translated via the `report` namespace.
    expect(html).toContain('Tidsrapport');
    expect(html).toContain('Träffsäkerhet');
    expect(html).toContain('Hur lång tid saker faktiskt tar dig');
    expect(html).toContain('<html lang="sv">');
  });

  it('still renders English month + labels when the app language is en', () => {
    const html = buildReportHtml(model(), css);
    expect(html).toContain('Jun');
    expect(html).toContain('Time report');
    expect(html).toContain('<html lang="en">');
  });
});
