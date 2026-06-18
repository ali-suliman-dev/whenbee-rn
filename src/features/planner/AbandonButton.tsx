import { useState } from 'react';
import { Modal, Pressable, View, type ViewStyle, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { haptics } from '@/src/lib/haptics';
import type { usePlanner } from './usePlanner';

// ──────────────────────────────────────────────────────────────────────────────
// AbandonButton — the ONLY red element in the planner feature.
//
// A small red pill in the top-bar right slot. Tap → confirm sheet clarifies the
// action and reassures the user their learning is intact before they commit.
//
// Red is justified: this is a destructive action (clears today's plan). Everywhere
// else in the feature is amber/indigo. This pill is intentionally the exception.
// ──────────────────────────────────────────────────────────────────────────────

type PlannerHandle = ReturnType<typeof usePlanner>;

interface AbandonButtonProps {
  clearActive: PlannerHandle['clearActive'];
  /** True when every task in the plan is done — shows a neutral "New plan" button instead of destructive Abandon. */
  allDone?: boolean;
}

export function AbandonButton({ clearActive, allDone = false }: AbandonButtonProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [confirming, setConfirming] = useState(false);

  function handleOpen() {
    haptics.light();
    if (allDone) {
      // All tasks done — no destructive confirm needed, clear immediately.
      clearActive();
      return;
    }
    setConfirming(true);
  }

  function handleConfirm() {
    haptics.medium();
    setConfirming(false);
    clearActive();
  }

  function handleCancel() {
    haptics.light();
    setConfirming(false);
  }

  // ── Pill trigger ─────────────────────────────────────────────────────────────
  const pillWrapper: ViewStyle = {
    alignSelf: 'flex-start',
    paddingBottom: allDone ? 0 : t.burst.coinEdge,
  };

  const pillEdge: ViewStyle = {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: t.size.control.sm,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.dangerEdge,
  };

  const pillSurface: ViewStyle = {
    height: t.size.control.sm,
    borderRadius: t.radii.full,
    backgroundColor: allDone ? t.colors.surface : t.colors.danger,
    borderWidth: allDone ? t.borderWidth.share : 0,
    borderColor: allDone ? t.colors.hairline : undefined,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: t.space[3],
  };

  const pillLabel: TextStyle = {
    fontSize: t.fontSize.sm,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: allDone ? t.colors.inkSoft : t.colors.onIndigo,
  };

  // ── Confirm sheet ─────────────────────────────────────────────────────────────
  const sheet: ViewStyle = {
    backgroundColor: t.colors.bg,
    borderTopLeftRadius: t.radii.sheet,
    borderTopRightRadius: t.radii.sheet,
    paddingTop: t.space[5],
    paddingHorizontal: t.space[5],
    paddingBottom: Math.max(insets.bottom, t.space[5]),
    gap: t.space[4],
  };

  const heading: TextStyle = {
    fontSize: t.fontSize.title,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    color: t.colors.ink,
    letterSpacing: t.letterSpacing.tight,
  };

  const body: TextStyle = {
    fontSize: t.fontSize.base,
    color: t.colors.inkSoft,
    lineHeight: t.fontSize.base * t.lineHeight.relaxed,
  };

  return (
    <>
      {/* ── Pill trigger ── */}
      <Pressable
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel="Abandon this plan"
        style={pillWrapper}
      >
        {!allDone ? <View style={pillEdge} /> : null}
        <View style={pillSurface}>
          <AppText style={pillLabel}>{allDone ? 'New plan' : 'Abandon'}</AppText>
        </View>
      </Pressable>

      {/* ── Confirm sheet ── */}
      <Modal
        visible={confirming}
        transparent
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: t.colors.scrim }}>
          <View style={sheet}>
            <View style={{ gap: t.space[2] }}>
              <AppText style={heading}>Start fresh?</AppText>
              <AppText style={body}>
                {"This clears today's plan. Everything Whenbee has learned about your timing stays — nothing is lost."}
              </AppText>
            </View>

            <View style={{ gap: t.space[2] }}>
              <AppButton
                label="Yes, clear the plan"
                variant="danger"
                size="md"
                fullWidth
                onPress={handleConfirm}
              />
              <AppButton
                label="Keep my plan"
                variant="ghost"
                size="md"
                fullWidth
                onPress={handleCancel}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
