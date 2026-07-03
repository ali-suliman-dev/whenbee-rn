import { View, Text, ScrollView, type TextStyle } from 'react-native';
import { Screen } from '@/src/components/Screen';
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
    <Screen edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={{ gap: t.space[5], paddingTop: t.space[3], paddingBottom: t.space[6] }}
        showsVerticalScrollIndicator={false}
      >
        <SheetGrabber />

        <View style={{ gap: t.space[1] }}>
          <Text style={heading}>How long did it really take?</Text>
          <Text style={sub}>A rough number is plenty.</Text>
        </View>

        <View style={{ gap: t.space[2] }}>
          <Text style={fieldLabel}>WHAT WAS IT?</Text>
          <TaskTitleField
            variant="boxed"
            value={r.label}
            onChangeText={r.setLabel}
            placeholder="e.g. Tidied the kitchen"
            accessibilityLabel="What was it"
          />
        </View>

        <View style={{ gap: t.space[2] }}>
          <Text style={fieldLabel}>CATEGORY</Text>
          <CategoryChips
            categories={r.categories}
            value={r.category}
            onChange={r.setCategory}
            guessedId={r.guessedCategory}
            usage={r.usage}
          />
        </View>

        <View style={{ gap: t.space[2] }}>
          <Text style={fieldLabel}>YOUR GUESS</Text>
          <TimeField value={r.guessMin} onChange={r.setGuessMin} />
        </View>

        <View style={{ gap: t.space[2] }}>
          <Text style={fieldLabel}>WHAT IT REALLY TOOK</Text>
          <TimeField value={r.actualMin} onChange={r.setActualMin} />
        </View>

        <View style={{ gap: t.space[3], paddingTop: t.space[2] }}>
          <AppButton
            label="Save & ripen"
            variant="indigo"
            fullWidth
            disabled={!r.canSave}
            onPress={() => void r.onSave()}
          />
          <Text style={saveHint}>+1 nectar · ripens your honey a little</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
