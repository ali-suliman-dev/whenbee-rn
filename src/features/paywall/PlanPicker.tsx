import { useMemo } from 'react';
import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { haptics } from '@/src/lib/haptics';
import type { Offering, Package, PackageDuration } from '@/src/services/purchases';

// ──────────────────────────────────────────────────────────────────────────────
// PlanPicker — three selectable plan rows, ordered Lifetime (anchor) → Yearly
// (pre-selected hero) → Monthly, by DURATION TAG, never array order. Lifetime
// leads so its price makes the yearly read small (decoy anchoring, <5% of
// purchases industry-wide); yearly carries a MOST POPULAR badge and shows the
// per-month equivalent as its primary number. Every price is read from the store
// package's `priceString`; nothing is hardcoded.
//
// Selected styling mirrors the Chip/Card "selected" language: a primarySoft tint
// and the indigo selection stroke, so a picked plan reads like a picked chip.
// ──────────────────────────────────────────────────────────────────────────────

const ORDER: PackageDuration[] = ['lifetime', 'yearly', 'monthly'];

const TITLE: Record<PackageDuration, string> = {
  yearly: 'Yearly',
  lifetime: 'Lifetime',
  monthly: 'Monthly',
  other: 'Plan',
};

const BADGE_LABEL = 'MOST POPULAR';

/** Pull the first numeric value out of a localized price string (e.g. "USD 12,50" → 12.5). */
function parsePrice(priceString: string): number | null {
  const cleaned = priceString.replace(/[^\d.,]/g, '').replace(/,/g, '.');
  const match = cleaned.match(/\d+(\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Per-month equivalent of the yearly price (yearly ÷ 12, store currency), or null if unparseable.
 *
 * Returns null when no non-empty prefix currency symbol is found (suffix-currency
 * locales such as "34,99 €") — the yearly total then stays the primary number, so
 * the absence is graceful. Also handles ISO-code prefixes ("USD 34.99") and
 * zero-decimal currencies (no fractional separator → whole number, no cents).
 */
function perMonthValue(yearly: Package | undefined): string | null {
  if (!yearly) return null;
  const y = parsePrice(yearly.priceString);
  if (y == null) return null;

  const symbolMatch = yearly.priceString.match(/^[^\d]*/);
  const symbol = symbolMatch ? symbolMatch[0].trim() : '';
  if (symbol.length === 0) return null;

  const numericPart = yearly.priceString.replace(/^[^\d]+/, '');
  const isZeroDecimal = !/[.,]\d{2}/.test(numericPart);
  const per = isZeroDecimal ? String(Math.round(y / 12)) : (y / 12).toFixed(2);

  const separator = /^[A-Za-z]+$/.test(symbol) ? ' ' : '';
  return `${symbol}${separator}${per}`;
}

/** Plain-language note under each plan title. No guilt, no fake urgency. */
function noteFor(pkg: Package, perMonth: string | null): string {
  switch (pkg.duration) {
    case 'lifetime':
      return 'Pay once. Yours forever.';
    case 'yearly':
      return perMonth != null
        ? `7 days free, then ${pkg.priceString} a year`
        : '7 days free, then billed yearly';
    case 'monthly':
      return '7 days free, then billed monthly';
    default:
      return '';
  }
}

export function PlanPicker({
  offering,
  selectedId,
  onSelect,
}: {
  offering: Offering;
  selectedId: string | null;
  onSelect: (pkg: Package) => void;
}) {
  const t = useTheme();

  // Order the offering's packages into the anchor → hero → monthly sequence,
  // dropping any duration we don't surface (e.g. weekly/"other").
  const ordered = useMemo(() => {
    const byDuration = new Map<PackageDuration, Package>();
    for (const pkg of offering.packages) byDuration.set(pkg.duration, pkg);
    return ORDER.map((d) => byDuration.get(d)).filter((p): p is Package => p != null);
  }, [offering]);

  const yearly = ordered.find((p) => p.duration === 'yearly');
  const perMonth = perMonthValue(yearly);

  const titleStyle: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const noteStyle: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
  };
  const priceStyle: TextStyle = {
    fontFamily: 'Inter-Bold',
    fontSize: t.fontSize.lg,
    color: t.colors.ink,
    fontVariant: ['tabular-nums'],
  };
  // One step down the scale from `eyebrow` (xs 10 → 2xs 8) and a weight up (Bold
  // → ExtraBold): at badge size the extra weight is what holds legibility once
  // the size drops. Tracking stays at the badge's own 0.5 — wide tracking at this
  // size inflates the footprint straight back to where it started.
  const badgeText: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    fontFamily: 'Jakarta-ExtraBold',
    fontSize: t.fontSize['2xs'],
    color: t.colors.onAmber,
    letterSpacing: 0.5,
  };
  const perUnitStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  return (
    <View style={{ gap: t.space[3] }}>
      {ordered.map((pkg) => {
        const selected = pkg.id === selectedId;
        const isHero = pkg.duration === 'yearly';
        const heroPerMonth = isHero ? perMonth : null;

        const row: ViewStyle = {
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space[3],
          minHeight: t.size.control.lg,
          borderRadius: t.radii.card,
          borderCurve: 'continuous',
          paddingHorizontal: t.space[4],
          paddingVertical: t.space[3],
          backgroundColor: selected ? t.colors.primarySoft : t.colors.surface,
          borderWidth: selected ? t.borderWidth.thin : t.borderWidth.hairline,
          borderColor: selected ? t.colors.primary : t.colors.hairline,
        };
        const badge: ViewStyle = {
          backgroundColor: t.colors.accent,
          borderRadius: t.radii.full,
          paddingHorizontal: t.space[2],
          paddingVertical: t.space[0.5],
        };

        return (
          <Pressable
            key={pkg.id}
            onPress={() => {
              haptics.light();
              onSelect(pkg);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            accessibilityLabel={`${TITLE[pkg.duration]}, ${noteFor(pkg, perMonth)}, ${pkg.priceString}`}
            style={row}
          >
            <View style={{ flex: 1, gap: t.space[0.5] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[2] }}>
                <Text style={titleStyle}>{TITLE[pkg.duration]}</Text>
                {isHero ? (
                  <View style={badge}>
                    <Text style={badgeText}>{BADGE_LABEL}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={noteStyle}>{noteFor(pkg, perMonth)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: t.space[0.5] }}>
              <Text style={priceStyle}>{heroPerMonth ?? pkg.priceString}</Text>
              {heroPerMonth ? <Text style={perUnitStyle}>per month</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
