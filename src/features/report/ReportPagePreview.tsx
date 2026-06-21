import { View } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { Text, type TextStyle } from 'react-native';
import type { ReportModel } from './reportModel';

// ──────────────────────────────────────────────────────────────────────────────
// ReportPagePreview — an in-app React render of page 1's SHAPE, drawn with app
// primitives and tokens. NOT a WebView, NOT the print HTML: this is the calm,
// light "what your PDF looks like" panel inside the builder and the locked teaser.
// It always reads in the light surface palette (a paper preview), and shows the
// title, accuracy figure, a small sparkline, and the first couple of bias rows.
// ──────────────────────────────────────────────────────────────────────────────

function Sparkline({ values, color, track }: { values: number[]; color: string; track: string }) {
  const t = useTheme();
  // A row of slim bars whose height maps to accuracy 0–100. Calm, no axis chrome.
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.space[1], height: t.size.sparkline }}>
      {values.map((v, i) => {
        const ratio = Math.max(0.08, Math.min(1, v / 100));
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: `${ratio * 100}%`,
              backgroundColor: i === values.length - 1 ? color : track,
              borderRadius: t.radii.sm,
              borderCurve: 'continuous',
            }}
          />
        );
      })}
    </View>
  );
}

export function ReportPagePreview({ model }: { model: ReportModel }) {
  const t = useTheme();
  const rows = model.categories.slice(0, 3);

  const labelStyle: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const heroStyle: TextStyle = { ...(type.honestNumberXl as unknown as TextStyle), color: t.colors.primaryEdge };
  const defStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const rowName: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.ink };
  const rowVal: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft, fontVariant: ['tabular-nums'] };

  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderRadius: t.radii.md,
        borderCurve: 'continuous',
        padding: t.space[4],
        gap: t.space[3],
      }}
    >
      {/* Title block */}
      <View style={{ gap: t.space[0.5] }}>
        <Text style={{ ...(type.subtitle as unknown as TextStyle), color: t.colors.ink }}>Time report</Text>
        <Text style={defStyle}>{model.window.label}</Text>
      </View>

      {/* Accuracy hero + sparkline */}
      <View style={{ gap: t.space[1] }}>
        <Text style={labelStyle}>Estimation accuracy</Text>
        <Text style={heroStyle}>{model.accuracyPct}%</Text>
        {model.accuracySpark.length > 1 ? (
          <Sparkline values={model.accuracySpark} color={t.colors.primary} track={t.colors.primarySoft} />
        ) : null}
      </View>

      {/* A couple of bias rows */}
      <View style={{ gap: t.space[2], paddingTop: t.space[1] }}>
        {rows.map((row) => (
          <View
            key={row.categoryId}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.space[3] }}
          >
            <Text style={rowName} numberOfLines={1}>
              {row.categoryName}
            </Text>
            <Text style={rowVal}>
              {row.typicalGuessMin}m → {row.honestMin}m
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
