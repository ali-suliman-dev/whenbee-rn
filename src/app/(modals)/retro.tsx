import { View, Text, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/src/components/Screen';
import { SheetScrollView } from '@/src/components/SheetScrollView';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { AppButton } from '@/src/components/AppButton';
import { TaskTitleField } from '@/src/components/TaskTitleField';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useRetro } from '@/src/features/retro/useRetro';
import { CategoryChips } from '@/src/features/shared/CategoryChips';
import { TimeField } from '@/src/features/shared/TimeField';

// ──────────────────────────────────────────────────────────────────────────────
// Retro entry (Screen 5, formSheet) — forgiving catch-up logging for a task
// finished without a timer. A rough number is plenty; chips not typing; no
// guilt. "Save & ripen" feeds applyLog (source:'retro', engine halves alpha)
// and lands the same reward payoff as a timed log.
// ──────────────────────────────────────────────────────────────────────────────

export default function Retro() {
  const t = useTheme();
  const { t: tt } = useTranslation('review');
  const insets = useSafeAreaInsets();
  const r = useRetro();

  const heading: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const sub: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  const fieldLabel: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const saveHint: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
    textAlign: 'center',
  };

  return (
    <Screen edges={['left', 'right']} horizontalPadding={false}>
      {/* Fixed drag header — OUTSIDE the ScrollView so it is NOT the sheet's
          scrolling child. On Android that makes the whole top of the sheet (grabber
          + heading) a real drag-to-dismiss zone; the scroll child below only
          scrolls. Equal top/bottom breathing room (space[5]) top and bottom. */}
      <View style={{ paddingTop: t.space[5], paddingBottom: t.space[4], gap: t.space[3] }}>
        <SheetGrabber />
        <View style={{ gap: t.space[1] }}>
          <Text style={heading}>{tt('retro.heading')}</Text>
          <Text style={sub}>{tt('retro.sub')}</Text>
        </View>
      </View>

      {/* flexShrink (not flex:1): the ScrollView is only as tall as its fields when
          they fit, so the space below is plain sheet background — a drag-to-dismiss
          zone, not scroll child. It shrinks and scrolls only when the fields
          overflow. */}
      <SheetScrollView
        style={{ flexShrink: 1 }}
        contentContainerStyle={{
          gap: t.space[5],
          paddingBottom: t.space[4],
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: t.space[2] }}>
          <Text style={fieldLabel}>{tt('retro.whatWasItLabel')}</Text>
          <TaskTitleField
            variant="boxed"
            value={r.label}
            onChangeText={r.setLabel}
            placeholder={tt('retro.titlePlaceholder')}
            accessibilityLabel={tt('retro.titleA11y')}
          />
        </View>

        <View style={{ gap: t.space[2] }}>
          <Text style={fieldLabel}>{tt('retro.categoryLabel')}</Text>
          <CategoryChips
            categories={r.categories}
            value={r.category}
            onChange={r.setCategory}
            guessedId={r.guessedCategory}
            usage={r.usage}
          />
        </View>

        <View style={{ gap: t.space[2] }}>
          <Text style={fieldLabel}>{tt('retro.yourGuessLabel')}</Text>
          <TimeField value={r.guessMin} onChange={r.setGuessMin} />
        </View>

        <View style={{ gap: t.space[2] }}>
          <Text style={fieldLabel}>{tt('retro.actualLabel')}</Text>
          <TimeField value={r.actualMin} onChange={r.setActualMin} />
        </View>
      </SheetScrollView>

      {/* Hint + primary action — OUTSIDE the ScrollView, pinned to the bottom by
          marginTop:'auto'. The gap that auto-margin opens above it is sheet
          background, so dragging there dismisses; the fields still scroll above. */}
      <View style={{ gap: t.space[3], marginTop: 'auto', paddingBottom: insets.bottom + t.space[2] }}>
        <Text style={saveHint}>{tt('retro.saveHint')}</Text>
        <AppButton
          label={tt('retro.saveCta')}
          variant="indigo"
          fullWidth
          disabled={!r.canSave}
          onPress={() => void r.onSave()}
        />
      </View>
    </Screen>
  );
}
