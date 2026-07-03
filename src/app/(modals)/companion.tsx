import { useEffect, useState } from 'react';
import { View, TextInput, type TextStyle, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { WhenbeeAvatar } from '@/src/features/whenbee/WhenbeeAvatar';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { type CompanionStage } from '@/src/engine';
import { useCalibrationStore } from '@/src/stores/calibrationStore';

const NAME_MAX = 20;

// ──────────────────────────────────────────────────────────────────────────────
// Companion naming sheet (C16). Optional, one-field, editable any time. The look
// is already procedurally unique via the frozen seed; the name is the one thing
// the user chooses. Reached by tapping the bee on the hub, or from Settings.
// ──────────────────────────────────────────────────────────────────────────────

export default function CompanionRoute() {
  const t = useTheme();
  const loadReclaimSummary = useCalibrationStore((s) => s.loadReclaimSummary);
  const nameCompanion = useCalibrationStore((s) => s.nameCompanion);

  const [stage, setStage] = useState<CompanionStage>(1);
  const [seed, setSeed] = useState(1);
  const [drift, setDrift] = useState<'settled' | 'curious'>('settled');
  const [draft, setDraft] = useState('');

  useEffect(() => {
    let active = true;
    void loadReclaimSummary().then((s) => {
      if (!active) return;
      setStage(s.companion.stage);
      setSeed(s.companion.seed);
      setDrift(s.companion.driftHealth);
      setDraft(s.companion.name ?? '');
    });
    return () => {
      active = false;
    };
  }, [loadReclaimSummary]);

  function save() {
    void nameCompanion(draft.trim() || null).then(() => router.back());
  }

  const lead: TextStyle = {
    ...(type.body as unknown as TextStyle),
    color: t.colors.inkSoft,
    textAlign: 'center',
  };
  const field: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.hairline,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
  };
  const input: TextStyle = {
    ...(type.bodyLg as unknown as TextStyle),
    color: t.colors.ink,
    paddingVertical: t.space[3],
    textAlign: 'center',
  };

  return (
    <Screen edges={['left', 'right']}>
      <SheetGrabber />
      <View style={{ gap: t.space[6], paddingTop: t.space[6] }}>
        <WhenbeeAvatar
          stage={stage}
          seed={seed}
          driftHealth={drift}
          name={draft.trim() || undefined}
        />

        <AppText style={lead}>Give your companion a name, if you like. You can change it any time.</AppText>

        <View style={field}>
          <TextInput
            autoFocus
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={save}
            placeholder="e.g. Buzz"
            placeholderTextColor={t.colors.inkSoft}
            maxLength={NAME_MAX}
            returnKeyType="done"
            accessibilityLabel="Companion name"
            style={input}
          />
        </View>

        <AppButton label="Save" variant="indigo" fullWidth onPress={save} />
      </View>
    </Screen>
  );
}
