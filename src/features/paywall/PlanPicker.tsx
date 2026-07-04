import { useMemo } from 'react';
import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { haptics } from '@/src/lib/haptics';
import type { Offering, Package, PackageDuration } from '@/src/services/purchases';

// ──────────────────────────────────────────────────────────────────────────────
// PlanPicker — three selectable plan rows, ordered Yearly (hero) → Lifetime →
// Monthly by DURATION TAG, never array order. Every price is read from the
// store package's `priceString`; nothing is hardcoded.
//
// Selected styling mirrors the Chip/Card "selected" language: a primarySoft tint
// and a 1.5px indigo border (the same indigo selection stroke the chips use),
// so a picked plan reads identically to a picked chip elsewhere in the app.
//
// The Yearly hero carries a "Save 42%" badge. The percentage is COMPUTED from the
// real yearly vs monthly priceStrings when both parse cleanly; if a locale's
// price can't be parsed, we fall back to the labeled "Save 42%" (the locked offer
// in 06-MONETIZATION) rather than print a wrong number.
// ──────────────────────────────────────────────────────────────────────────────

const ORDER: PackageDuration[] = ['yearly', 'lifetime', 'monthly'];

/** Localized plan title per duration. `other` never surfaces in `ORDER` today. */
function titleFor(tr: TFunction<'paywall'>, duration: PackageDuration): string {
  return tr(`planPicker.title.${duration}`);
}

/** Plain-language note under each plan title. No guilt, no fake urgency.
 * `other` (e.g. weekly) is dropped by `ORDER` before rendering and has no copy. */
function noteFor(tr: TFunction<'paywall'>, duration: PackageDuration): string {
  if (duration === 'other') return '';
  return tr(`planPicker.note.${duration}`);
}

/** Pull the first numeric value out of a localized price string (e.g. "USD 12,50" → 12.5). */
function parsePrice(priceString: string): number | null {
  const cleaned = priceString.replace(/[^\d.,]/g, '').replace(/,/g, '.');
  const match = cleaned.match(/\d+(\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Savings of yearly vs 12× monthly, as "Save N%", or the labeled fallback. */
function savingsLabel(
  tr: TFunction<'paywall'>,
  yearly: Package | undefined,
  monthly: Package | undefined,
): string {
  const y = yearly ? parsePrice(yearly.priceString) : null;
  const m = monthly ? parsePrice(monthly.priceString) : null;
  if (y == null || m == null) return tr('planPicker.savingsFallback');
  const annualized = m * 12;
  if (annualized <= y) return tr('planPicker.savingsFallback');
  const pct = Math.round((1 - y / annualized) * 100);
  return tr('planPicker.savingsLabel', { pct });
}

/** Per-month equivalent of the yearly price (e.g. "≈ $2.92 / mo"), or null if unparseable.
 *
 * Returns null when no non-empty prefix currency symbol is found (suffix-currency
 * locales such as "34,99 €") — the yearly total price still shows, so the absence
 * is graceful. Also handles:
 *  - ISO-code prefixes ("USD 34.99" → "≈ USD 2.92 / mo", with a separating space)
 *  - Zero-decimal currencies (no fractional separator → whole number, no cents)
 */
function perMonthLabel(yearly: Package | undefined): string | null {
  if (!yearly) return null;
  const y = parsePrice(yearly.priceString);
  if (y == null) return null;

  // Capture any non-digit prefix (may be empty for suffix-currency locales).
  const symbolMatch = yearly.priceString.match(/^[^\d]*/);
  const symbol = symbolMatch ? symbolMatch[0].trim() : '';

  // Omit the line when there is no prefix symbol — rendering "≈ 2.92 / mo" (no
  // currency indicator at all) would be ambiguous and worse than showing nothing.
  if (symbol.length === 0) return null;

  // Determine decimal precision: zero-decimal currencies have no fractional part
  // in the price string's numeric section (e.g. "¥3500", "₩12000").
  const numericPart = yearly.priceString.replace(/^[^\d]+/, '');
  const isZeroDecimal = !/[.,]\d{2}/.test(numericPart);
  const per = isZeroDecimal ? String(Math.round(y / 12)) : (y / 12).toFixed(2);

  // ISO-code prefixes (all-alpha, e.g. "USD") need a space before the digits to
  // read correctly. Glyph symbols ($, £, ¥, €…) keep no space.
  const separator = /^[A-Za-z]+$/.test(symbol) ? ' ' : '';

  return `≈ ${symbol}${separator}${per} / mo`;
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
  const { t: tr } = useTranslation('paywall');

  // Order the offering's packages into the hero → lifetime → monthly sequence,
  // dropping any duration we don't surface (e.g. weekly/"other").
  const ordered = useMemo(() => {
    const byDuration = new Map<PackageDuration, Package>();
    for (const pkg of offering.packages) byDuration.set(pkg.duration, pkg);
    return ORDER.map((d) => byDuration.get(d)).filter((p): p is Package => p != null);
  }, [offering]);

  const yearly = ordered.find((p) => p.duration === 'yearly');
  const monthly = ordered.find((p) => p.duration === 'monthly');
  const savings = savingsLabel(tr, yearly, monthly);
  const perMonth = perMonthLabel(yearly);

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
  const badgeText: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.onAmber,
    letterSpacing: 0.5,
  };
  const perMonthStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft, fontVariant: ['tabular-nums'] };

  return (
    <View style={{ gap: t.space[3] }}>
      {ordered.map((pkg) => {
        const selected = pkg.id === selectedId;
        const isHero = pkg.duration === 'yearly';

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
            accessibilityLabel={tr('planPicker.accessibilityLabel', {
              title: titleFor(tr, pkg.duration),
              note: noteFor(tr, pkg.duration),
              price: pkg.priceString,
            })}
            style={row}
          >
            <View style={{ flex: 1, gap: t.space[0.5] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[2] }}>
                <Text style={titleStyle}>{titleFor(tr, pkg.duration)}</Text>
                {isHero ? (
                  <View style={badge}>
                    <Text style={badgeText}>{savings.toUpperCase()}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={noteStyle}>{noteFor(tr, pkg.duration)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: t.space[0.5] }}>
              <Text style={priceStyle}>{pkg.priceString}</Text>
              {isHero && perMonth ? <Text style={perMonthStyle}>{perMonth}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
