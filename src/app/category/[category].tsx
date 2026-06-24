import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { Toast } from '@/src/components/Toast';
import { HoneyHex } from '@/src/components/HoneyHex';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useCategoryDetail } from '@/src/features/category-detail/useCategoryDetail';
import { HonestCard } from '@/src/features/category-detail/HonestCard';
import { GraduationMoment } from '@/src/features/category-detail/GraduationMoment';
import { AhaCard } from '@/src/features/category-detail/AhaCard';
import { AdaptSegment } from '@/src/features/category-detail/AdaptSegment';
import { ProHonestWeekTease } from '@/src/features/category-detail/ProHonestWeekTease';
import { TrendChart } from '@/src/features/category-detail/TrendChart';
import { RecentList } from '@/src/features/category-detail/RecentList';
import { GoalCard } from '@/src/features/category-detail/GoalCard';
import { GoalLocked } from '@/src/features/category-detail/GoalLocked';
import { ProGate } from '@/src/features/paywall/ProGate';
import { TIERS } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// Category Detail / Tune — pushes over the tab shell (no tab bar), back chevron.
//
// Turns one category's bias into self-knowledge: the honest number, the FREE
// aha card (all categories), the learning-mode tuner, the calibration trend, and
// the recent receipts. Framed as power, never failure. No guilt, no red, no
// streaks — over-runs read amber.
// ──────────────────────────────────────────────────────────────────────────────

export default function CategoryDetailScreen() {
  const t = useTheme();
  const { category } = useLocalSearchParams<{ category: string }>();
  const categoryId = category ?? '';
  const {
    detail,
    loading,
    adaptSpeed,
    setAdaptSpeed,
    resetCategory,
    justGraduated,
    clearJustGraduated,
    reasonNote,
    isPro,
  } = useCategoryDetail(categoryId);

  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 1900);
  }

  function handleSetAdapt(speed: 'steady' | 'balanced' | 'reactive') {
    setAdaptSpeed(speed);
    const label = speed.charAt(0).toUpperCase() + speed.slice(1);
    showToast(`Adaptation set to ${label}`);
  }

  async function handleReset() {
    await resetCategory();
    setConfirming(false);
    showToast('Start fresh — your honey stays');
  }

  const nextTierIdx = detail ? TIERS.indexOf(detail.tier) + 1 : -1;
  const nextTier = nextTierIdx > 0 && nextTierIdx < TIERS.length ? TIERS[nextTierIdx] : null;

  return (
    <Screen>
      <View style={{ flex: 1 }}>
        {/* Top bar (Ha) — breadcrumb back, then a large title + honey tier pill */}
        <View style={styles(t).header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={t.size.hitSlop}
            style={styles(t).crumb}
          >
            <Ionicons name="chevron-back" size={t.iconSize.md} color={t.colors.inkSoft} />
            <Text style={styles(t).crumbText}>Category insights</Text>
          </Pressable>
          <View style={styles(t).titleRow}>
            <Text style={styles(t).h2} numberOfLines={1}>{detail?.categoryName ?? ' '}</Text>
            {detail?.tier ? (
              <View style={styles(t).tierPill}>
                <HoneyHex size={t.space[2.5]} />
                <Text style={styles(t).tierPillText}>{detail.tier}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {detail && !loading ? (
          <ScrollView
            contentContainerStyle={{
              gap: t.space[5],
              paddingTop: t.space[4],
              paddingBottom: t.space[16],
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* 1 — Hero: the honest number, with ripeness + progress folded in. */}
            <HonestCard
              categoryName={detail.categoryName}
              honestMinutes={detail.summary.honestMinutes}
              multiplier={detail.mEffective}
              provenance={detail.summary.label}
              tier={detail.tier}
              n={detail.n}
              logsToNext={detail.logsToNext}
              nextTier={nextTier}
              confidence={detail.confidence}
              range={detail.summary.range}
              reasonNote={reasonNote}
              isPro={isPro}
              firstHonestRange={detail.firstHonestRange}
            />

            {/* 2 — Pro: the always-on payoff anchor (free users only; Pro users get
                the live band inside the hero instead of a tease). */}
            {!isPro ? <ProHonestWeekTease /> : null}

            {/* 3 — The aha insight (when there's one worth surfacing). */}
            {detail.insight ? (
              <AhaCard insight={detail.insight} categoryName={detail.categoryName} n={detail.n} />
            ) : null}

            {/* 4 — The receipts, trend, and learning control. Quiet inline sections
                split by hairlines (no card chrome) so the hero + Pro card lead. */}
            <View style={styles(t).sections}>
              <RecentList recent={detail.recent} />
              <View style={styles(t).divider} />
              <View style={styles(t).trendCard}>
                <TrendChart trend={detail.trend} />
              </View>
              <View style={styles(t).divider} />
              <AdaptSegment value={adaptSpeed} onChange={handleSetAdapt} />
            </View>

            {/* 5 — Pro: a forward goal on this category (Pro live card / locked teaser). */}
            <ProGate fallback={<GoalLocked categoryId={categoryId} />}>
              <GoalCard categoryId={categoryId} categoryName={detail.categoryName} />
            </ProGate>

            {/* Quiet reset */}
            <View style={styles(t).resetBlock}>
              {confirming ? (
                <View style={{ gap: t.space[3] }}>
                  <Text style={styles(t).resetConfirmCopy}>
                    Reset this category&apos;s learning? Start fresh — your honey stays.
                  </Text>
                  <View style={styles(t).resetActions}>
                    <Pressable
                      onPress={() => setConfirming(false)}
                      accessibilityRole="button"
                      accessibilityLabel="Keep this category's learning"
                      style={styles(t).resetCancel}
                    >
                      <Text style={styles(t).resetCancelText}>Keep it</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleReset}
                      accessibilityRole="button"
                      accessibilityLabel="Confirm reset category learning"
                      style={styles(t).resetConfirm}
                    >
                      <Text style={styles(t).resetConfirmText}>Reset</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => setConfirming(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Reset this category's learning"
                  style={styles(t).resetLink}
                >
                  <Ionicons name="refresh-outline" size={16} color={t.colors.inkSoft} />
                  <Text style={styles(t).resetLinkText}>Reset this category&apos;s learning</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        ) : (
          <View style={styles(t).loading}>
            <Text style={styles(t).loadingText}>Reading your patterns…</Text>
          </View>
        )}

        <Toast message={toast ?? ''} visible={toast !== null} />

        {justGraduated && detail ? (
          <GraduationMoment
            honestMinutes={detail.summary.honestMinutes}
            multiplier={detail.summary.multiplier}
            sampleSize={detail.summary.sampleSize}
            onDone={clearJustGraduated}
          />
        ) : null}
      </View>
    </Screen>
  );
}

function styles(t: ReturnType<typeof useTheme>) {
  return {
    header: {
      paddingTop: t.space[2],
      gap: t.space[1],
    } as ViewStyle,
    // Breadcrumb back row — the chevron + "Category insights" reads as one tappable
    // crumb (44pt target via hitSlop), the eyebrow now lives here instead of above.
    crumb: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.space[1],
      minHeight: 36,
      marginLeft: -t.space[1],
    } as ViewStyle,
    crumbText: {
      ...(type.bodySmBold as unknown as TextStyle),
      fontSize: t.fontSize.crumb,
      color: t.colors.inkSoft,
    } as TextStyle,
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: t.space[3],
    } as ViewStyle,
    h2: {
      ...(type.display as unknown as TextStyle),
      fontSize: t.fontSize.lg,
      lineHeight: t.fontSize.lg * t.lineHeight.normal,
      color: t.colors.ink,
      flexShrink: 1,
    } as TextStyle,
    // Honey tier pill — the category's ripeness, on the warm-solid chip surface.
    tierPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.space[1.5],
      backgroundColor: t.colors.accentChip,
      borderRadius: t.radii.full,
      borderCurve: 'continuous',
      paddingHorizontal: t.space[3],
      paddingVertical: t.space[1.5],
    } as ViewStyle,
    tierPillText: {
      ...(type.captionBold as unknown as TextStyle),
      fontSize: t.fontSize.xs,
      color: t.colors.amberText,
    } as TextStyle,
    // The receipts / trend / tuner sit directly on the page (no surface) split by
    // clear hairline dividers — dividers alone define the sections, no borders.
    sections: { gap: t.space[5] } as ViewStyle,
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: t.colors.divider } as ViewStyle,
    // Only the trend gets a subtle surface — a quiet panel so the chart reads as a
    // contained module; Recent + Tune stay flat on the page.
    trendCard: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radii.card,
      borderCurve: 'continuous',
      padding: t.space[4],
    } as ViewStyle,
    tierRow: { flexDirection: 'row', alignItems: 'center', gap: t.space[2] } as ViewStyle,
    // Tier = honey ripeness → amber, consistent with the Today honeycomb pill.
    pill: {
      backgroundColor: t.colors.accentSoft,
      borderRadius: t.radii.full,
      paddingHorizontal: t.space[3],
      paddingVertical: t.space[0.5],
    } as ViewStyle,
    pillText: {
      ...(type.caption as unknown as TextStyle),
      color: t.colors.amberText,
      fontFamily: 'Jakarta-Bold',
    } as TextStyle,
    tierMeta: { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft } as TextStyle,
    resetBlock: { paddingTop: t.space[2] } as ViewStyle,
    // A quiet filled pill (the same raised `surface` as other interactive wells)
    // — reads as tappable without a border or the indigo CTA color. Hugs its
    // content and centers, so it looks like a control, not a line of body text.
    resetLink: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.space[2],
      minHeight: 44,
      paddingHorizontal: t.space[4],
      paddingVertical: t.space[2],
      borderRadius: t.radii.full,
      borderCurve: 'continuous',
      backgroundColor: t.colors.surface,
    } as ViewStyle,
    resetLinkText: {
      ...(type.bodySm as unknown as TextStyle),
      color: t.colors.inkSoft,
    } as TextStyle,
    resetConfirmCopy: {
      ...(type.bodySm as unknown as TextStyle),
      color: t.colors.ink,
      textAlign: 'center',
    } as TextStyle,
    resetActions: { flexDirection: 'row', justifyContent: 'center', gap: t.space[3] } as ViewStyle,
    resetCancel: {
      minHeight: 44,
      paddingHorizontal: t.space[5],
      borderRadius: t.radii.full,
      borderWidth: t.borderWidth.thin,
      borderColor: t.colors.hairline,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    resetCancelText: { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink } as TextStyle,
    resetConfirm: {
      minHeight: 44,
      paddingHorizontal: t.space[5],
      borderRadius: t.radii.full,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    resetConfirmText: {
      ...(type.bodySm as unknown as TextStyle),
      color: t.colors.onIndigo,
    } as TextStyle,
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' } as ViewStyle,
    loadingText: { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft } as TextStyle,
  };
}
