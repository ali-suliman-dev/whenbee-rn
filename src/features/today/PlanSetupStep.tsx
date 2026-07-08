import { useCallback } from 'react';
import { View, Switch, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { getCalendar } from '@/src/services/calendar';
import { useStartByToggle } from './useStartByToggle';

// One consent row: ValueStack icon tile + title + description + trailing Switch.
// Same visual grammar as the paywall ValueStack so the setup reads as first-class.
function ConsentRow({
  icon,
  title,
  desc,
  value,
  onValueChange,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  testID: string;
}) {
  const t = useTheme();
  const tile: ViewStyle = {
    width: t.space[8],
    height: t.space[8],
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const row: ViewStyle = { flexDirection: 'row', gap: t.space[3], alignItems: 'center' };
  const titleStyle: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.ink,
    fontFamily: 'Jakarta-Bold',
  };
  const descStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  return (
    <View style={row}>
      <View style={tile}>
        <Ionicons name={icon} size={t.iconSize.sm} color={t.colors.primary} />
      </View>
      <View style={{ flex: 1, gap: t.space[0.5] }}>
        <AppText style={titleStyle}>{title}</AppText>
        <AppText style={descStyle}>{desc}</AppText>
      </View>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
        accessibilityLabel={title}
      />
    </View>
  );
}

/**
 * First-run consent step for the plan screen. Names the two potentially-silent
 * behaviours (calendar read, start-by nudge) and lets the user opt into each.
 * Both default OFF. Shown once (gated by `plan.setupSeen` in the route).
 */
export function PlanSetupStep({ onContinue }: { onContinue: () => void }) {
  const t = useTheme();
  const showEvents = useSettingsStore((s) => s.calendar.showEvents);
  const setShowEvents = useSettingsStore((s) => s.setShowEvents);
  const { enabled: startByEnabled, toggle: toggleStartBy } = useStartByToggle();

  // Enabling calendar asks for READ permission at that moment; only flip the
  // setting when granted so the toggle never lies about access.
  const onToggleCalendar = useCallback(
    async (next: boolean): Promise<void> => {
      if (!next) {
        setShowEvents(false);
        return;
      }
      const granted = await getCalendar().requestReadAccess();
      if (granted) setShowEvents(true);
    },
    [setShowEvents],
  );

  const onToggleReminder = useCallback(
    (next: boolean) => {
      void toggleStartBy(next);
    },
    [toggleStartBy],
  );

  return (
    <View style={{ gap: t.space[6] }}>
      <View style={{ gap: t.space[2] }}>
        <AppText
          accessibilityRole="header"
          style={{ ...(type.subtitle as unknown as TextStyle), color: t.colors.ink }}
        >
          Before we plan
        </AppText>
        <AppText style={{ ...(type.body as unknown as TextStyle), color: t.colors.inkSoft }}>
          Two optional helpers. Both stay off unless you switch them on.
        </AppText>
      </View>

      <View style={{ gap: t.space[5] }}>
        <ConsentRow
          icon="calendar-outline"
          title="Read today's calendar"
          desc="Whenbee slots your tasks around your meetings. Read-only — it never edits your events."
          value={showEvents}
          onValueChange={(next) => {
            void onToggleCalendar(next);
          }}
          testID="plan-setup-calendar"
        />
        <ConsentRow
          icon="notifications-outline"
          title="Nudge me when to start"
          desc="One quiet ping at your start-by time. No streaks, nothing to keep up."
          value={startByEnabled}
          onValueChange={onToggleReminder}
          testID="plan-setup-reminder"
        />
      </View>

      <AppButton
        label="Continue"
        onPress={onContinue}
        fullWidth
        accessibilityLabel="Continue to your plan"
      />
    </View>
  );
}
