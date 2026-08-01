import { useState } from 'react';
import { View, TextInput, useWindowDimensions, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { Chip } from '@/src/components/Chip';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useFeedback } from '@/src/features/feedback/useFeedback';
import type { FeedbackKind } from '@/src/features/feedback/types';

// ──────────────────────────────────────────────────────────────────────────────
// Send feedback (formSheet) — a private, one-way note straight to the founder.
// Tag (idea/problem/love) + free text — no area picker: it asked the user to
// file their own note and told them nothing they hadn't already written.
// Submits are optimistic:
// the sheet flips to the Sent state immediately (see useFeedback/submitFeedback
// for the background retry + offline queue — the user never sees a failure).
// ──────────────────────────────────────────────────────────────────────────────

const KINDS: { value: FeedbackKind; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'idea', icon: 'bulb-outline' },
  { value: 'problem', icon: 'alert-circle-outline' },
  { value: 'love', icon: 'heart-outline' },
];

export default function FeedbackSheet() {
  const t = useTheme();
  const { t: tr } = useTranslation('feedback');
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const { submit } = useFeedback();

  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [body, setBody] = useState('');
  const [sent, setSent] = useState(false);

  const canSend = kind !== null && body.trim().length > 0;

  function handleSend() {
    if (!canSend || kind === null) return;
    void submit({ kind, body: body.trim() });
    setSent(true);
  }

  return (
    // The formSheet's native contentStyle (see src/app/_layout.tsx) supplies the
    // side gutters — react-native-screens drops the LEFT padding of a padded JS
    // child inside a native sheet, so this screen takes horizontalPadding={false}
    // and adds no paddingHorizontal of its own.
    <Screen horizontalPadding={false} edges={['left', 'right']}>
      <SheetGrabber />
      {/* paddingTop is explicit: SheetGrabber renders null on Android, so without
          it the title jams against the sheet's top edge. */}
      <View
        style={{
          minHeight: winH * 0.95 - insets.bottom,
          paddingTop: t.space[5],
          paddingBottom: insets.bottom + t.space[5],
        }}
      >
        {sent ? (
          <SentState onDone={() => router.back()} />
        ) : (
          <>
            <AppText style={{ ...(type.title as TextStyle), color: t.colors.ink, marginBottom: t.space[1] }}>
              {tr('sheet.title')}
            </AppText>
            <AppText style={{ ...(type.body as TextStyle), color: t.colors.inkSoft, marginBottom: t.space[5] }}>
              {tr('sheet.lead')}
            </AppText>

            <AppText variant="label" style={{ marginBottom: t.space[2] }}>
              {tr('sheet.kindLabel')}
            </AppText>
            <View style={{ flexDirection: 'row', gap: t.space[2], marginBottom: t.space[5] }}>
              {KINDS.map((k) => (
                <Chip
                  key={k.value}
                  label={tr(`kind.${k.value}`)}
                  selected={kind === k.value}
                  onPress={() => setKind(k.value)}
                  icon={
                    <Ionicons
                      name={k.icon}
                      size={t.iconSize.sm}
                      color={kind === k.value ? t.colors.primary : t.colors.inkSoft}
                    />
                  }
                />
              ))}
            </View>

            <AppText variant="label" style={{ marginBottom: t.space[2] }}>
              {tr('sheet.noteLabel')}
            </AppText>
            {/* Sunken fill alone read as a flat block, not something you type in.
                A 1px edge + a taller box gives the field its own outline and makes
                the writing room obvious before the first tap. */}
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={tr('sheet.notePlaceholder')}
              placeholderTextColor={t.colors.inkFaint}
              multiline
              textAlignVertical="top"
              maxLength={4000}
              style={{
                minHeight: t.size.control.lg * 3,
                backgroundColor: t.colors.surfaceSunken,
                borderRadius: t.radii.md,
                borderCurve: 'continuous',
                borderWidth: t.borderWidth.chip,
                borderColor: t.colors.border,
                padding: t.space[4],
                color: t.colors.ink,
                ...(type.body as TextStyle),
              }}
            />

            <View style={{ flex: 1 }} />
            <AppButton label={tr('sheet.send')} onPress={handleSend} disabled={!canSend} fullWidth />
          </>
        )}
      </View>
    </Screen>
  );
}

function SentState({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const { t: tr } = useTranslation('feedback');
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      {/* The mark sat flush against the sheet's top edge: a flex spacer below it
          pushed the whole block up while `justifyContent: center` did nothing.
          Symmetric spacers above and below centre it for real, with a floor of
          breathing room at the top on short screens. */}
      <View style={{ flex: 1, minHeight: t.space[8] }} />
      <View style={{ alignItems: 'center', gap: t.space[4] }}>
        <Ionicons name="checkmark-circle-outline" size={t.iconSize.xl * 2} color={t.colors.accent} />
        <AppText style={{ ...(type.title as TextStyle), color: t.colors.ink }}>{tr('sent.title')}</AppText>
        <AppText style={{ ...(type.body as TextStyle), color: t.colors.inkSoft, textAlign: 'center', maxWidth: t.size.emptyCopy }}>
          {tr('sent.body')}
        </AppText>
      </View>
      <View style={{ flex: 1, minHeight: t.space[8] }} />
      <AppButton label={tr('sent.done')} onPress={onDone} variant="ghost" />
    </View>
  );
}
