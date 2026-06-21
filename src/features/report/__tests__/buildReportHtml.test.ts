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
    generatedAtMs: Date.UTC(2026, 5, 21),
    companionName: null,
    accuracyPct: 72,
    accuracySpark: [60, 64, 68, 70, 71, 72],
    totalLogs: 24,
    categoryCount: 2,
    steadiestCategoryName: 'Admin & email',
    categories: [
      {
        categoryId: 'getting_ready',
        categoryName: 'Getting ready',
        logs: 14,
        typicalGuessMin: 15,
        honestMin: 24,
        range: { lowMinutes: 20, highMinutes: 26 },
        multiplier: 1.6,
      },
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
    surprises: [
      { categoryName: 'Writing', label: 'Blog post', estimateMin: 30, actualMin: 90 },
    ],
    sharpestNote: 'Your estimates land closest on mornings.',
    omittedCategoryCount: 1,
    ...overrides,
  };
}

describe('buildReportHtml', () => {
  it('includes the page title and the window label', () => {
    const html = buildReportHtml(model(), css);
    expect(html).toContain('Time report');
    expect(html).toContain('Last 30 days');
  });

  it('renders the accuracy hero figure and its definition', () => {
    const html = buildReportHtml(model(), css);
    expect(html).toContain('72%');
    expect(html).toContain('How close your time guesses landed to reality, on average.');
  });

  it('renders one bias-table row per category with the expected headers', () => {
    const html = buildReportHtml(model(), css);
    for (const header of ['Category', 'Logs', 'You guess', 'It really takes', 'Bias']) {
      expect(html).toContain(header);
    }
    expect(html).toContain('Getting ready');
    expect(html).toContain('Admin &amp; email');
  });

  it('omits the surprises section when there are no surprises', () => {
    const html = buildReportHtml(model({ surprises: [] }), css);
    expect(html).not.toContain('Biggest surprises');
  });

  it('renders the surprises section when surprises exist', () => {
    const html = buildReportHtml(model(), css);
    expect(html).toContain('Biggest surprises');
    expect(html).toContain('guessed 30m, took 90m');
  });

  it('omits the sharpest section when sharpestNote is null', () => {
    const html = buildReportHtml(model({ sharpestNote: null }), css);
    expect(html).not.toContain('When your estimates land closest');
  });

  it('includes the per-page disclaimer footer', () => {
    const html = buildReportHtml(model(), css);
    expect(html).toContain('These are personal estimates, not a clinical measure.');
    expect(html).toContain('Whenbee · personal time report');
  });

  it('shows the omitted-categories line when categories were left out', () => {
    const html = buildReportHtml(model(), css);
    expect(html).toContain('1 more');
    expect(html).toMatch(/still settling/);
  });

  it('includes the "Prepared by" line only when the companion name is set', () => {
    expect(buildReportHtml(model(), css)).not.toContain('Prepared by Whenbee');
    const named = buildReportHtml(model({ companionName: 'Buzz' }), css);
    expect(named).toContain('Prepared by Whenbee');
    expect(named).toContain('Buzz');
  });

  it('HTML-escapes user-controlled strings (category label with markup)', () => {
    const html = buildReportHtml(
      model({
        surprises: [
          { categoryName: 'Writing', label: '<script>alert(1)</script>', estimateMin: 10, actualMin: 40 },
        ],
      }),
      css,
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes a malicious companion name', () => {
    const html = buildReportHtml(model({ companionName: '<b>x</b>' }), css);
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  it('contains NO reclaim / time-saved string anywhere (reclaim removed)', () => {
    const html = buildReportHtml(model(), css).toLowerCase();
    expect(html).not.toMatch(/reclaim/);
    expect(html).not.toMatch(/time saved/);
    expect(html).not.toMatch(/time the honest numbers saved/);
    expect(html).not.toMatch(/saved you/);
  });

  it('makes no network call (buildReportHtml never invokes fetch)', () => {
    const fetchSpy = jest.fn();
    const original = global.fetch;
    (global as { fetch?: unknown }).fetch = fetchSpy;
    try {
      buildReportHtml(model(), css);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      (global as { fetch?: unknown }).fetch = original;
    }
  });

  it('uses tabular-nums in the generated CSS', () => {
    expect(css).toContain('tabular-nums');
  });
});
