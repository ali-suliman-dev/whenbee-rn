import { useCallback, useState, type ReactNode } from 'react';
import { View, Text, Pressable, Switch, ScrollView, type ViewStyle, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { ProUpsellCard } from '@/src/components/ProUpsellCard';
import { Chip } from '@/src/components/Chip';
import { AppearanceGlyph } from '@/src/components/icons/AppearanceGlyph';
import { DataResetGlyph } from '@/src/components/DataResetGlyph';
import { ConfirmSheet } from '@/src/components/ConfirmSheet';
import { Toast, AUTO_HIDE_MS } from '@/src/components/Toast';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useSettingsStore, type ColorModePref } from '@/src/stores/settingsStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useAccountActions, type RestoreOutcome } from '@/src/features/paywall/useAccountActions';
import { useReminderSetting } from '@/src/features/settings/useReminderSetting';
import { useAccountReset } from '@/src/features/settings/useAccountReset';

const modes: ColorModePref[] = ['system', 'light', 'dark'];

const RESTORE_MESSAGE: Record<RestoreOutcome, string> = {
  success: 'Pro restored.',
  none: 'No earlier purchase found.',
  error: "Couldn't reach the store — try again.",
};

const REMINDER_DENIED = 'Allow notifications in iOS Settings to get reminders.';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * One Settings row: leading icon, title + optional note, and a trailing control —
 * a chevron when the row navigates, or any `trailing` node (e.g. a Switch) when it
 * doesn't. Every row shares this shape so titles and notes line up down the list.
 */
function SettingRow({
  icon,
  leading,
  title,
  note,
  onPress,
  tint,
  disabled,
  trailing,
  accessibilityLabel,
}: {
  icon?: IconName;
  /** Custom leading visual (e.g. an SVG glyph). Rendered instead of `icon`. */
  leading?: ReactNode;
  title: string;
  note?: string;
  onPress?: () => void;
  tint?: string;
  disabled?: boolean;
  trailing?: ReactNode;
  accessibilityLabel?: string;
}) {
  const t = useTheme();

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    minHeight: t.size.control.lg,
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.hairline,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
    opacity: disabled ? 0.5 : 1,
  };
  const titleStyle: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const noteStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  const content = (
    <>
      {leading ?? (
        <Ionicons name={icon as IconName} size={t.iconSize.md} color={tint ?? t.colors.inkSoft} />
      )}
      <View style={{ flex: 1, gap: t.space[0.5] }}>
        <Text style={titleStyle}>{title}</Text>
        {note ? <Text style={noteStyle}>{note}</Text> : null}
      </View>
      {trailing ?? (
        <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkSoft} />
      )}
    </>
  );

  // No onPress → a static row (the trailing control is the only interactive part).
  if (!onPress) {
    return <View style={row}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel ?? title}
      style={row}
    >
      {content}
    </Pressable>
  );
}

export default function Settings() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { colorMode, setColorMode } = useSettingsStore();
  const dailyRitualEnabled = useSettingsStore((s) => s.dailyRitualEnabled);
  const setDailyRitualEnabled = useSettingsStore((s) => s.setDailyRitualEnabled);
  const isPro = useEntitlement((s) => s.isPro);
  const categoryCount = useCategoriesStore((s) => s.categories.length);
  const { restoring, manageSubscription, restorePurchases } = useAccountActions();
  const { enabled: remindersEnabled, toggle: toggleReminders } = useReminderSetting();
  const { resetting, resetProgress, eraseEverything } = useAccountReset();

  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [sheet, setSheet] = useState<null | 'progress' | 'erase'>(null);

  const showToast = useCallback((message: string) => {
    setToastMsg(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), AUTO_HIDE_MS);
  }, []);

  function openPaywall() {
    router.push({ pathname: '/(modals)/paywall', params: { trigger: 'settings_upgrade' } });
  }

  function openHonestDay() {
    router.push('/(modals)/honest-day');
  }

  async function handleRestore() {
    if (restoring) return;
    const outcome = await restorePurchases();
    showToast(RESTORE_MESSAGE[outcome]);
  }

  async function handleToggleReminders(next: boolean) {
    const ok = await toggleReminders(next);
    if (next && !ok) showToast(REMINDER_DENIED);
  }

  async function handleResetProgress() {
    setSheet(null);
    await resetProgress();
    showToast('Reset done. Fresh slate.');
  }

  async function handleEraseEverything() {
    setSheet(null);
    await eraseEverything(); // navigates to onboarding; no toast needed
  }

  return (
    <Screen edges={['left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          gap: t.space[6],
          paddingTop: t.space[4],
          paddingBottom: insets.bottom + t.space[6],
        }}
      >
        <View style={{ gap: t.space[3] }}>
          <AppText variant="label">Whenbee Pro</AppText>
          {isPro ? (
            <SettingRow
              icon="time-outline"
              tint={t.colors.accent}
              title="Make my whole day honest"
              note="Map your real buffers onto today's calendar."
              onPress={openHonestDay}
              accessibilityLabel="Make my whole day honest"
            />
          ) : (
            <ProUpsellCard
              title="Make my whole day honest"
              note="Auto-pad your calendar with your real buffers."
              onPress={openPaywall}
              accessibilityLabel="Go Pro and make your whole day honest"
            />
          )}
        </View>

        <View style={{ gap: t.space[3] }}>
          <AppText variant="label">Appearance</AppText>
          <View style={{ flexDirection: 'row', gap: t.space[2] }}>
            {modes.map((m) => (
              <Chip
                key={m}
                label={m}
                icon={<AppearanceGlyph kind={m} selected={colorMode === m} size={t.iconSize.md} />}
                selected={colorMode === m}
                onPress={() => setColorMode(m)}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: t.space[3] }}>
          <AppText variant="label">General</AppText>
          <SettingRow
            icon="albums-outline"
            title="Categories"
            note={`${categoryCount} tracked`}
            onPress={() => router.push('/categories')}
          />
          <SettingRow
            icon="happy-outline"
            title="Name your Whenbee"
            note="Give your companion a name."
            onPress={() => router.push('/(modals)/companion')}
          />
          <SettingRow
            icon="notifications-outline"
            title="Time-up reminders"
            note="One nudge when your honest estimate is up."
            trailing={
              <Switch
                value={remindersEnabled}
                onValueChange={handleToggleReminders}
                trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
                accessibilityLabel="Time-up reminders"
              />
            }
          />
          <SettingRow
            icon="sparkles-outline"
            title="Daily check-in"
            note="Puts a line on Today that nudges you to log one thing, then checks off once you do. Skip a day and nothing breaks."
            trailing={
              <Switch
                value={dailyRitualEnabled}
                onValueChange={setDailyRitualEnabled}
                trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
                accessibilityLabel="Daily check-in"
              />
            }
          />
          <SettingRow
            icon="lock-closed-outline"
            title="Privacy"
            note="What stays on your phone."
            onPress={() => router.push('/privacy')}
          />
        </View>

        <View style={{ gap: t.space[3] }}>
          <AppText variant="label">Account</AppText>
          {isPro ? (
            <SettingRow
              icon="card-outline"
              title="Manage subscription"
              note="Change your plan or cancel in the App Store."
              onPress={manageSubscription}
            />
          ) : null}
          <SettingRow
            icon="refresh-outline"
            title="Restore purchases"
            note="Paid before? Bring your Pro access back."
            onPress={handleRestore}
            disabled={restoring}
          />
        </View>

        <View style={{ gap: t.space[3] }}>
          <AppText variant="label" style={{ color: t.colors.danger }}>
            Danger zone
          </AppText>
          <SettingRow
            leading={<DataResetGlyph kind="progress" size={t.iconSize.md} />}
            title="Reset progress"
            note="Forget what it learned, keep your setup."
            tint={t.colors.accent}
            onPress={() => setSheet('progress')}
            disabled={resetting}
          />
          <SettingRow
            leading={<DataResetGlyph kind="erase" size={t.iconSize.md} />}
            title="Erase everything"
            note="Wipe the app and start the welcome over."
            tint={t.colors.danger}
            onPress={() => setSheet('erase')}
            disabled={resetting}
          />
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={sheet === 'progress'}
        tone="caution"
        glyphKind="progress"
        title="Reset your progress?"
        bullets={[
          'Clears every logged time and what Whenbee learned.',
          'Keeps your categories, look, and reminders.',
          'Your Whenbee keeps its name and just starts growing again.',
        ]}
        confirmLabel="Reset progress"
        onConfirm={handleResetProgress}
        onCancel={() => setSheet(null)}
      />
      <ConfirmSheet
        visible={sheet === 'erase'}
        tone="danger"
        glyphKind="erase"
        title="Erase everything?"
        bullets={[
          'Deletes all of it: tasks, learning, categories, settings.',
          "You'll start from the welcome screen, like a fresh install.",
          "Pro isn't stored here, so 'Restore purchases' brings it back.",
        ]}
        confirmLabel="Erase everything"
        onConfirm={handleEraseEverything}
        onCancel={() => setSheet(null)}
      />

      <Toast message={toastMsg} visible={toastVisible} />
    </Screen>
  );
}
