import { useMemo } from 'react';
import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
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

const TITLE: Record<PackageDuration, string> = {
  yearly: 'Yearly',
  lifetime: 'Lifetime',
  monthly: 'Monthly',
  other: 'Plan',
};

// Plain-language note under each plan title. No guilt, no fake urgency.
const NOTE: Record<PackageDuration, string> = {
  yearly: '7-day free trial, then billed yearly',
  lifetime: 'Pay once. No subscription, ever.',
  monthly: '7-day free trial, then billed monthly',
  other: '',
};

const FALLBACK_SAVINGS = 'Save 42%';

/** Pull the first numeric value out of a localized price string (e.g. "USD 12,50" → 12.5). */
function parsePrice(priceString: string): number | null {
  const cleaned = priceString.replace(/[^\d.,]/g, '').replace(/,/g, '.');
  const match = cleaned.match(/\d+(\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Savings of yearly vs 12× monthly, as "Save N%", or the labeled fallback. */
function savingsLabel(yearly: Package | undefined, monthly: Package | undefined): string {
  const y = yearly ? parsePrice(yearly.priceString) : null;
  const m = monthly ? parsePrice(monthly.priceString) : null;
  if (y == null || m == null) return FALLBACK_SAVINGS;
  const annualized = m * 12;
  if (annualized <= y) return FALLBACK_SAVINGS;
  const pct = Math.round((1 - y / annualized) * 100);
  return `Save ${pct}%`;
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

  // Order the offering's packages into the hero → lifetime → monthly sequence,
  // dropping any duration we don't surface (e.g. weekly/"other").
  const ordered = useMemo(() => {
    const byDuration = new Map<PackageDuration, Package>();
    for (const pkg of offering.packages) byDuration.set(pkg.duration, pkg);
    return ORDER.map((d) => byDuration.get(d)).filter((p): p is Package => p != null);
  }, [offering]);

  const yearly = ordered.find((p) => p.duration === 'yearly');
  const monthly = ordered.find((p) => p.duration === 'monthly');
  const savings = savingsLabel(yearly, monthly);

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
            accessibilityLabel={`${TITLE[pkg.duration]}, ${NOTE[pkg.duration]}, ${pkg.priceString}`}
            style={row}
          >
            <View style={{ flex: 1, gap: t.space[0.5] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[2] }}>
                <Text style={titleStyle}>{TITLE[pkg.duration]}</Text>
                {isHero ? (
                  <View style={badge}>
                    <Text style={badgeText}>{savings.toUpperCase()}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={noteStyle}>{NOTE[pkg.duration]}</Text>
            </View>
            <Text style={priceStyle}>{pkg.priceString}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
