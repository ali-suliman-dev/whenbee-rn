import { useState } from 'react';
import { View, Text, Pressable, ScrollView, type ViewStyle, type TextStyle } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { Toast } from '@/src/components/Toast';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useCategoryDetail } from '@/src/features/category-detail/useCategoryDetail';
import { HonestCard } from '@/src/features/category-detail/HonestCard';
import { AhaCard } from '@/src/features/category-detail/AhaCard';
import { AdaptSegment } from '@/src/features/category-detail/AdaptSegment';
import { TrendChart } from '@/src/features/category-detail/TrendChart';
import { RecentList } from '@/src/features/category-detail/RecentList';
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
  const { detail, loading, adaptSpeed, setAdaptSpeed, resetCategory } = useCategoryDetail(categoryId);

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
        {/* Top bar — back chevron + eyebrow + category name */}
        <View style={styles(t).topBar}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={10}
            style={styles(t).backBtn}
          >
            <Ionicons name="chevron-back" size={24} color={t.colors.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles(t).eyebrow}>CATEGORY INSIGHTS</Text>
            <Text style={styles(t).h2}>{detail?.categoryName ?? ' '}</Text>
          </View>
        </View>

        {detail && !loading ? (
          <ScrollView
            contentContainerStyle={{ gap: t.space[5], paddingTop: t.space[4], paddingBottom: t.space[16] }}
            showsVerticalScrollIndicator={false}
          >
            {/* Tier pill + logs progress line */}
            <View style={styles(t).tierRow}>
              <View style={styles(t).pill}>
                <Text style={styles(t).pillText}>{detail.tier}</Text>
              </View>
              <Text style={styles(t).tierMeta}>
                {detail.n} {detail.n === 1 ? 'log' : 'logs'}
                {nextTier ? ` · ${detail.logsToNext} to ${nextTier}` : ''}
              </Text>
            </View>

            <HonestCard
              categoryName={detail.categoryName}
              honestMinutes={detail.summary.honestMinutes}
              multiplier={detail.mEffective}
              provenance={detail.summary.label}
            />

            {detail.insight ? (
              <AhaCard insight={detail.insight} categoryName={detail.categoryName} n={detail.n} />
            ) : null}

            <AdaptSegment value={adaptSpeed} onChange={handleSetAdapt} />

            <TrendChart trend={detail.trend} />

            <RecentList recent={detail.recent} />

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
      </View>
    </Screen>
  );
}

function styles(t: ReturnType<typeof useTheme>) {
  return {
    topBar: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.space[2],
      paddingTop: t.space[2],
    } as ViewStyle,
    backBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: -t.space[2],
    } as ViewStyle,
    eyebrow: { ...(type.eyebrow as unknown as TextStyle), color: t.colors.primary } as TextStyle,
    h2: { ...(type.title as unknown as TextStyle), color: t.colors.ink } as TextStyle,
    tierRow: { flexDirection: 'row', alignItems: 'center', gap: t.space[2] } as ViewStyle,
    pill: {
      backgroundColor: t.colors.primaryTint,
      borderRadius: t.radii.pill,
      paddingHorizontal: t.space[3],
      paddingVertical: 3,
    } as ViewStyle,
    pillText: {
      ...(type.caption as unknown as TextStyle),
      color: t.colors.primary,
      fontFamily: 'Jakarta-Bold',
    } as TextStyle,
    tierMeta: { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft } as TextStyle,
    resetBlock: { paddingTop: t.space[2] } as ViewStyle,
    resetLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.space[2],
      minHeight: 44,
    } as ViewStyle,
    resetLinkText: { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft } as TextStyle,
    resetConfirmCopy: {
      ...(type.bodySm as unknown as TextStyle),
      color: t.colors.ink,
      textAlign: 'center',
    } as TextStyle,
    resetActions: { flexDirection: 'row', justifyContent: 'center', gap: t.space[3] } as ViewStyle,
    resetCancel: {
      minHeight: 44,
      paddingHorizontal: t.space[5],
      borderRadius: t.radii.pill,
      borderWidth: 1.5,
      borderColor: t.colors.hairline,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    resetCancelText: { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink } as TextStyle,
    resetConfirm: {
      minHeight: 44,
      paddingHorizontal: t.space[5],
      borderRadius: t.radii.pill,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    resetConfirmText: { ...(type.bodySm as unknown as TextStyle), color: t.colors.onIndigo } as TextStyle,
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' } as ViewStyle,
    loadingText: { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft } as TextStyle,
  };
}
