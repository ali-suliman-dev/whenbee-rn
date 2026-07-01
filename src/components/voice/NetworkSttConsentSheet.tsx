// Two lightweight bottom prompts shown when on-device speech recognition isn't
// available: NetworkSttConsentSheet asks explicit, honest, per-locale consent
// before any words are sent to the OS network recognizer (Apple/Google) —
// voice is always optional, typing always works. DownloadModelPrompt offers
// the Android offline-model download instead, when one exists. Entering-only,
// opacity/scale (no slide, no bounce — CLAUDE.md rule); reduced-motion snaps
// to the final state.

import { useEffect } from 'react';
import { Modal, Pressable, View, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';

type PromptKey =
  | 'networkConsent.title'
  | 'networkConsent.body'
  | 'networkConsent.confirm'
  | 'networkConsent.cancel'
  | 'networkConsent.dismissA11y'
  | 'download.title'
  | 'download.body'
  | 'download.cta'
  | 'download.cancel'
  | 'download.dismissA11y';

interface PromptSheetProps {
  visible: boolean;
  titleKey: PromptKey;
  bodyKey: PromptKey;
  primaryLabelKey: PromptKey;
  cancelLabelKey: PromptKey;
  dismissA11yKey: PromptKey;
  onConfirm: () => void;
  onCancel: () => void;
}

const PromptSheet = ({
  visible,
  titleKey,
  bodyKey,
  primaryLabelKey,
  cancelLabelKey,
  dismissA11yKey,
  onConfirm,
  onCancel,
}: PromptSheetProps) => {
  const t = useTheme();
  const { t: tr } = useTranslation('voice');
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      progress.set(visible ? 1 : 0);
      return;
    }
    progress.set(withTiming(visible ? 1 : 0, { duration: t.motion.base, easing: Easing.out(Easing.cubic) }));
  }, [visible, reduced, progress, t.motion.base]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: 0.98 + progress.get() * 0.02 }],
  }));

  if (!visible) return null;

  const sheet: ViewStyle = {
    backgroundColor: t.colors.bg,
    borderTopLeftRadius: t.radii.sheet,
    borderTopRightRadius: t.radii.sheet,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[5],
    paddingTop: t.space[3],
    paddingBottom: Math.max(insets.bottom, t.space[5]),
    gap: t.space[5],
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
    <Modal transparent visible={visible} animationType="none" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={[
            { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.scrim },
            scrimStyle,
          ]}
        >
          <Pressable style={{ flex: 1 }} accessibilityLabel={tr(dismissA11yKey)} onPress={onCancel} />
        </Animated.View>

        <Animated.View style={[sheet, sheetStyle]}>
          <SheetGrabber />
          <View style={{ gap: t.space[2] }}>
            <AppText variant="title" style={heading}>{tr(titleKey)}</AppText>
            <AppText variant="body" style={body}>{tr(bodyKey)}</AppText>
          </View>

          <View style={{ gap: t.space[2] }}>
            <AppButton label={tr(primaryLabelKey)} variant="indigo" fullWidth onPress={onConfirm} />
            <AppButton label={tr(cancelLabelKey)} variant="ghost" fullWidth onPress={onCancel} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

interface NetworkSttConsentSheetProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Explicit per-locale consent before speech is ever sent to the network recognizer. */
export const NetworkSttConsentSheet = ({ visible, onConfirm, onCancel }: NetworkSttConsentSheetProps) => (
  <PromptSheet
    visible={visible}
    titleKey="networkConsent.title"
    bodyKey="networkConsent.body"
    primaryLabelKey="networkConsent.confirm"
    cancelLabelKey="networkConsent.cancel"
    dismissA11yKey="networkConsent.dismissA11y"
    onConfirm={onConfirm}
    onCancel={onCancel}
  />
);

interface DownloadModelPromptProps {
  visible: boolean;
  onDownload: () => void;
  onCancel: () => void;
}

/** Offers the Android offline speech-model download instead of network fallback. */
export const DownloadModelPrompt = ({ visible, onDownload, onCancel }: DownloadModelPromptProps) => (
  <PromptSheet
    visible={visible}
    titleKey="download.title"
    bodyKey="download.body"
    primaryLabelKey="download.cta"
    cancelLabelKey="download.cancel"
    dismissA11yKey="download.dismissA11y"
    onConfirm={onDownload}
    onCancel={onCancel}
  />
);
