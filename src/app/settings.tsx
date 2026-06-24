import { useCallback, useState, type ReactNode } from 'react';
import { Alert, Modal, View, Text, Pressable, Switch, ScrollView, TextInput, type ViewStyle, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { ProUpsellCard } from '@/src/components/ProUpsellCard';
import { Chip } from '@/src/components/Chip';
import { AppearanceGlyph } from '@/src/components/icons/AppearanceGlyph';
import { DataResetGlyph } from '@/src/components/DataResetGlyph';
import { ConfirmSheet } from '@/src/components/ConfirmSheet';
import { Toast, AUTO_HIDE_MS } from '@/src/components/Toast';
import { FinishTimeWheel } from '@/src/features/planner/FinishTimeWheel';
import { dayEndEpochFor, formatClockMeridiem } from '@/src/lib/time';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useSettingsStore, type ColorModePref } from '@/src/stores/settingsStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useAccountActions, type RestoreOutcome } from '@/src/features/paywall/useAccountActions';
import { useReminderSetting } from '@/src/features/settings/useReminderSetting';
import { useReviewNotifySetting } from '@/src/features/settings/useReviewNotifySetting';
import { useDayEndSetting } from '@/src/features/settings/useDayEndSetting';
import { useQuietHours } from '@/src/features/settings/useQuietHours';
import { useNotificationSound } from '@/src/features/settings/useNotificationSound';
import { useAccountReset } from '@/src/features/settings/useAccountReset';
import { usePresenceSection } from '@/src/features/settings/usePresenceSection';
import { ProGate } from '@/src/features/paywall/ProGate';
import { PresenceRingTeaser } from '@/src/components/PresenceRingTeaser';
import { GuardrailSettingRow } from '@/src/features/settings/GuardrailSettingRow';
import { GuardrailLockedRow } from '@/src/features/settings/GuardrailLockedRow';
import { seedDemoData } from '@/src/features/dev/seedDemoData';

const modes: ColorModePref[] = ['system', 'light', 'dark'];

const SOUND_OPTIONS: { value: 'honey' | 'default' | 'none'; label: string }[] = [
  { value: 'honey', label: 'Honey' },
  { value: 'default', label: 'Default' },
  { value: 'none', label: 'None' },
];

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
  const titleStyle: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.ink };
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
  const displayName = useSettingsStore((s) => s.displayName);
  const setDisplayName = useSettingsStore((s) => s.setDisplayName);
  const dailyRitualEnabled = useSettingsStore((s) => s.dailyRitualEnabled);
  const setDailyRitualEnabled = useSettingsStore((s) => s.setDailyRitualEnabled);
  const isPro = useEntitlement((s) => s.isPro);
  const setPro = useEntitlement((s) => s.setPro);
  const categoryCount = useCategoriesStore((s) => s.categories.length);
  const { restoring, manageSubscription, restorePurchases } = useAccountActions();
  const { enabled: remindersEnabled, toggle: toggleReminders } = useReminderSetting();
  const { enabled: reviewNotifyEnabled, toggle: toggleReviewNotify } = useReviewNotifySetting();
  const honestReachedEnabled = useSettingsStore((s) => s.honestReachedEnabled);
  const setHonestReachedEnabled = useSettingsStore((s) => s.setHonestReachedEnabled);
  const startByEnabled = useSettingsStore((s) => s.startByEnabled);
  const setStartByEnabled = useSettingsStore((s) => s.setStartByEnabled);
  const {
    quietHours,
    update: updateQuietHours,
    editingBoundary,
    openStart: openQuietStart,
    openEnd: openQuietEnd,
    closeEditor: closeQuietEditor,
    saveBoundary: saveQuietBoundary,
  } = useQuietHours();
  const { value: notificationSound, set: setNotificationSound } = useNotificationSound();
  const {
    dayEndMin,
    label: dayEndLabel,
    editing: dayEndEditing,
    open: openDayEnd,
    close: closeDayEnd,
    save: saveDayEnd,
    dayEndEnabled,
    setDayEndEnabled,
  } = useDayEndSetting();
  const { resetting, resetProgress, eraseEverything } = useAccountReset();
  const { isPresenceAvailable, handlePresenceCta } = usePresenceSection();

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

  async function handleToggleReviewNotify(next: boolean) {
    const ok = await toggleReviewNotify(next);
    if (next && !ok) showToast(REMINDER_DENIED);
  }

  async function handleResetProgress() {
    setSheet(null);
    await resetProgress();
    showToast('Reset done. Fresh slate.');
  }

  function handleWidgetHelp() {
    Alert.alert(
      'How to add the widget',
      'Long-press your Home Screen, tap +, search Whenbee, then choose "Next task".',
    );
  }

  async function handleEraseEverything() {
    setSheet(null);
    await eraseEverything(); // navigates to onboarding; no toast needed
  }

  const [seeding, setSeeding] = useState(false);
  async function handleSeedDemo() {
    if (seeding) return;
    setSeeding(true);
    try {
      const n = await seedDemoData();
      showToast(`Seeded ${n} logs across 2 months.`);
    } finally {
      setSeeding(false);
    }
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
          <AppText variant="label">Your Whenbee</AppText>
          <SettingRow
            icon="albums-outline"
            title="Categories"
            note={`${categoryCount} tracked`}
            onPress={() => router.push('/categories')}
          />
          <View
            style={{
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
            }}
          >
            <Ionicons name="person-outline" size={t.iconSize.md} color={t.colors.inkSoft} />
            <TextInput
              accessibilityLabel="Your name"
              placeholder="Tell Whenbee your name"
              placeholderTextColor={t.colors.inkFaint}
              value={displayName ?? ''}
              onChangeText={(text) => setDisplayName(text || undefined)}
              style={{
                flex: 1,
                ...(type.bodySmBold as unknown as TextStyle),
                color: t.colors.ink,
              }}
              returnKeyType="done"
              autoCorrect={false}
            />
          </View>
          <SettingRow
            icon="time-outline"
            title="Re-take time-style quiz"
            note="Update your time-personality seed."
            onPress={() => router.push('/(modals)/archetype-quiz')}
            accessibilityLabel="Re-take time-style quiz"
          />
          <SettingRow
            icon="happy-outline"
            title="Name your Whenbee"
            note="Give your companion a name."
            onPress={() => router.push('/(modals)/companion')}
          />
        </View>

        <View style={{ gap: t.space[3] }}>
          <AppText variant="label">Notifications</AppText>

          {/* Master reminders toggle */}
          <SettingRow
            icon="notifications-outline"
            title="Reminders"
            note="Pings for honest finish, start-by nudges, and more."
            trailing={
              <Switch
                value={remindersEnabled}
                onValueChange={handleToggleReminders}
                trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
                accessibilityLabel="Reminders"
              />
            }
          />

          {/* Per-type sub-rows — only visible when reminders are on */}
          {remindersEnabled ? (
            <>
              <SettingRow
                icon="checkmark-circle-outline"
                title="Honest finish reached"
                note="A ping when your honest estimate is up."
                trailing={
                  <Switch
                    value={honestReachedEnabled}
                    onValueChange={setHonestReachedEnabled}
                    trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
                    accessibilityLabel="Honest finish reached"
                  />
                }
              />
              <SettingRow
                icon="arrow-forward-circle-outline"
                title="Start-by nudge"
                note="A reminder when it's time to begin your next task."
                trailing={
                  <Switch
                    value={startByEnabled}
                    onValueChange={setStartByEnabled}
                    trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
                    accessibilityLabel="Start-by nudge"
                  />
                }
              />
              {isPro ? (
                <SettingRow
                  icon="leaf-outline"
                  title="Monday review"
                  note="A gentle nudge when your honest week is ready. Off by default."
                  trailing={
                    <Switch
                      value={reviewNotifyEnabled}
                      onValueChange={handleToggleReviewNotify}
                      trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
                      accessibilityLabel="Monday review"
                    />
                  }
                />
              ) : null}
              <ProGate fallback={<GuardrailLockedRow />}>
                <GuardrailSettingRow />
              </ProGate>

              {/* Quiet hours — toggle + tappable boundary rows when enabled */}
              <SettingRow
                icon="moon-outline"
                title="Quiet hours"
                note="Suppress notifications during sleep or focus windows."
                trailing={
                  <Switch
                    value={quietHours.enabled}
                    onValueChange={(v) => updateQuietHours({ enabled: v })}
                    trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
                    accessibilityLabel="Quiet hours"
                  />
                }
              />
              {quietHours.enabled ? (
                <>
                  <SettingRow
                    icon="time-outline"
                    title={`From  ${formatClockMeridiem(dayEndEpochFor(Date.now(), quietHours.startMin))}`}
                    note="Quiet window starts"
                    onPress={openQuietStart}
                    accessibilityLabel="Quiet hours start time"
                  />
                  <SettingRow
                    icon="time-outline"
                    title={`Until  ${formatClockMeridiem(dayEndEpochFor(Date.now(), quietHours.endMin))}`}
                    note="Quiet window ends"
                    onPress={openQuietEnd}
                    accessibilityLabel="Quiet hours end time"
                  />
                </>
              ) : null}

              {/* Sound selector — chip row mirroring GuardrailSettingRow */}
              <View
                style={{
                  gap: t.space[3],
                  backgroundColor: t.colors.surface,
                  borderWidth: t.borderWidth.hairline,
                  borderColor: t.colors.hairline,
                  borderRadius: t.radii.card,
                  borderCurve: 'continuous',
                  paddingHorizontal: t.space[4],
                  paddingVertical: t.space[3],
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}>
                  <Ionicons name="musical-note-outline" size={t.iconSize.md} color={t.colors.inkSoft} />
                  <View style={{ gap: t.space[0.5] }}>
                    <AppText
                      style={{
                        ...(type.bodySmBold as unknown as import('react-native').TextStyle),
                        color: t.colors.ink,
                      }}
                    >
                      Sound
                    </AppText>
                    <AppText
                      style={{
                        ...(type.caption as unknown as import('react-native').TextStyle),
                        color: t.colors.inkSoft,
                      }}
                    >
                      Tone played when a notification fires.
                    </AppText>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: t.space[2] }}>
                  {SOUND_OPTIONS.map((o) => (
                    <Chip
                      key={o.value}
                      label={o.label}
                      selected={notificationSound === o.value}
                      onPress={() => setNotificationSound(o.value)}
                    />
                  ))}
                </View>
              </View>
            </>
          ) : null}

          {/* Daily check-in — not gated by remindersEnabled */}
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
        </View>

        <View style={{ gap: t.space[3] }}>
          <AppText variant="label">Scheduling</AppText>
          <SettingRow
            icon="moon-outline"
            title="End of day"
            note={dayEndEnabled ? `Your day winds down around ${dayEndLabel}` : 'Off'}
            onPress={dayEndEnabled ? openDayEnd : undefined}
            accessibilityLabel={
              dayEndEnabled
                ? `End of day, currently ${dayEndLabel}. Tap to change.`
                : 'End of day, off'
            }
            trailing={
              <Switch
                value={dayEndEnabled}
                onValueChange={setDayEndEnabled}
                trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
                accessibilityLabel="End of day"
              />
            }
          />
        </View>

        <View style={{ gap: t.space[3] }}>
          <AppText variant="label">Your data</AppText>
          <SettingRow
            icon="document-text-outline"
            title="Export a report"
            note="A clean PDF of your real time data to keep or share with a coach or doctor."
            onPress={() => router.push('/(modals)/report')}
          />
          <SettingRow
            icon="lock-closed-outline"
            title="Privacy"
            note="What stays on your phone."
            onPress={() => router.push('/privacy')}
          />
        </View>

        <View style={{ gap: t.space[3] }}>
          <AppText variant="label">Presence</AppText>

          <View
            style={{
              backgroundColor: t.colors.surface,
              borderRadius: t.radii.card,
              borderCurve: 'continuous',
              padding: t.space[4],
              gap: t.space[3],
            }}
          >
            <AppText
              style={{
                ...(type.bodySmBold as unknown as import('react-native').TextStyle),
                color: t.colors.ink,
              }}
            >
              Keep your task on screen
            </AppText>
            <AppText
              style={{
                ...(type.bodySm as unknown as import('react-native').TextStyle),
                color: t.colors.inkSoft,
              }}
            >
              Your next task and its honest finish stay visible, even when Whenbee is closed.
            </AppText>

            {isPresenceAvailable ? (
              <AppButton
                label="How to add the widget"
                onPress={handleWidgetHelp}
                variant="ghost"
              />
            ) : (
              <AppText
                style={{
                  ...(type.caption as unknown as import('react-native').TextStyle),
                  color: t.colors.inkSoft,
                }}
              >
                Available on the App Store build.
              </AppText>
            )}

            <ProGate
              fallback={<PresenceRingTeaser onCtaPress={handlePresenceCta} />}
            >
              <AppText
                style={{
                  ...(type.bodySm as unknown as import('react-native').TextStyle),
                  color: t.colors.inkSoft,
                }}
              >
                Ring is on. Your honest finish shows on the Lock Screen while the timer runs.
              </AppText>
            </ProGate>
          </View>
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

        <View style={{ gap: t.space[3] }}>
          <AppText variant="label">Developer</AppText>
          <SettingRow
            icon="construct-outline"
            title="Unlock Pro (testing)"
            note="Flip the Pro entitlement to preview every gated screen. For testing — leave off in normal use."
            trailing={
              <Switch
                value={isPro}
                onValueChange={setPro}
                trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
                accessibilityLabel="Unlock Pro (testing)"
              />
            }
          />
          {__DEV__ && (
            <SettingRow
              icon="flask-outline"
              title="Seed demo data"
              note="Lay down ~2 months of logs across four categories so every Pro surface has something to show. Sim-only — resets the demo categories each run."
              onPress={handleSeedDemo}
              disabled={seeding}
            />
          )}
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

      <Modal
        visible={dayEndEditing}
        transparent
        animationType="fade"
        onRequestClose={closeDayEnd}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.scrim }}
            accessibilityLabel="Dismiss"
            onPress={closeDayEnd}
          />
          <View
            style={{
              backgroundColor: t.colors.surface,
              borderTopLeftRadius: t.radii.sheet,
              borderTopRightRadius: t.radii.sheet,
              borderCurve: 'continuous',
              paddingHorizontal: t.space[5],
              paddingTop: t.space[5],
              paddingBottom: insets.bottom + t.space[5],
              gap: t.space[4],
            }}
          >
            <AppText variant="title" style={{ color: t.colors.ink }}>
              When does your day wind down?
            </AppText>
            <FinishTimeWheel
              showModes={false}
              valueMs={dayEndEpochFor(Date.now(), dayEndMin)}
              onChange={(ms) => saveDayEnd(ms)}
            />
            <AppButton label="Done" onPress={closeDayEnd} variant="amber" fullWidth />
          </View>
        </View>
      </Modal>

      {/* Quiet hours time editor — mirrors the day-end modal exactly */}
      <Modal
        visible={editingBoundary !== null}
        transparent
        animationType="fade"
        onRequestClose={closeQuietEditor}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.scrim }}
            accessibilityLabel="Dismiss"
            onPress={closeQuietEditor}
          />
          <View
            style={{
              backgroundColor: t.colors.surface,
              borderTopLeftRadius: t.radii.sheet,
              borderTopRightRadius: t.radii.sheet,
              borderCurve: 'continuous',
              paddingHorizontal: t.space[5],
              paddingTop: t.space[5],
              paddingBottom: insets.bottom + t.space[5],
              gap: t.space[4],
            }}
          >
            <AppText variant="title" style={{ color: t.colors.ink }}>
              {editingBoundary === 'start' ? 'Quiet from' : 'Quiet until'}
            </AppText>
            <FinishTimeWheel
              showModes={false}
              valueMs={dayEndEpochFor(
                Date.now(),
                editingBoundary === 'start' ? quietHours.startMin : quietHours.endMin,
              )}
              onChange={(ms) => {
                if (editingBoundary !== null) saveQuietBoundary(editingBoundary, ms);
              }}
            />
            <AppButton label="Done" onPress={closeQuietEditor} variant="amber" fullWidth />
          </View>
        </View>
      </Modal>

      <Toast message={toastMsg} visible={toastVisible} />
    </Screen>
  );
}
