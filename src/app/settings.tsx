import { useCallback, useState, type ReactNode } from 'react';
import { Alert, Modal, View, Text, Pressable, Switch, ScrollView, TextInput, type ViewStyle, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
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
import { CalendarSettingsSection } from '@/src/features/settings/CalendarSettingsSection';
import { StripVariantSwitcher } from '@/src/features/settings/StripVariantSwitcher';
import { LanguagePicker } from '@/src/features/settings/LanguagePicker';
import { seedDemoData } from '@/src/features/dev/seedDemoData';

const modes: ColorModePref[] = ['system', 'light', 'dark'];

const SOUND_VALUES: ('honey' | 'default' | 'none')[] = ['honey', 'default', 'none'];

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
  const { t: tr } = useTranslation('settings');
  const insets = useSafeAreaInsets();
  const { colorMode, setColorMode } = useSettingsStore();
  const displayName = useSettingsStore((s) => s.displayName);
  const setDisplayName = useSettingsStore((s) => s.setDisplayName);
  const dailyRitualEnabled = useSettingsStore((s) => s.dailyRitualEnabled);
  const setDailyRitualEnabled = useSettingsStore((s) => s.setDailyRitualEnabled);
  const quickStartEnabled = useSettingsStore((s) => s.quickStartEnabled);
  const setQuickStartEnabled = useSettingsStore((s) => s.setQuickStartEnabled);
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

  const SOUND_OPTIONS: { value: 'honey' | 'default' | 'none'; label: string }[] = SOUND_VALUES.map(
    (value) => ({ value, label: tr(`soundOptions.${value}`) }),
  );

  const RESTORE_MESSAGE: Record<RestoreOutcome, string> = {
    success: tr('restoreMessage.success'),
    none: tr('restoreMessage.none'),
    error: tr('restoreMessage.error'),
  };

  const REMINDER_DENIED = tr('reminderDenied');

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
    showToast(tr('toasts.resetDone'));
  }

  function handleWidgetHelp() {
    Alert.alert(tr('widgetHelpAlert.title'), tr('widgetHelpAlert.message'));
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
      showToast(tr('toasts.seeded', { count: n }));
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
          <AppText variant="label">{tr('proSection.label')}</AppText>
          {isPro ? (
            <SettingRow
              icon="time-outline"
              tint={t.colors.accent}
              title={tr('proSection.title')}
              note={tr('proSection.noteOn')}
              onPress={openHonestDay}
              accessibilityLabel={tr('proSection.a11yOn')}
            />
          ) : (
            <ProUpsellCard
              title={tr('proSection.title')}
              note={tr('proSection.noteOff')}
              onPress={openPaywall}
              accessibilityLabel={tr('proSection.a11yOff')}
            />
          )}
        </View>

        <View style={{ gap: t.space[3] }}>
          <AppText variant="label">{tr('appearance.label')}</AppText>
          <View style={{ flexDirection: 'row', gap: t.space[2] }}>
            {modes.map((m) => (
              <Chip
                key={m}
                label={tr(`appearance.modes.${m}`)}
                icon={<AppearanceGlyph kind={m} selected={colorMode === m} size={t.iconSize.md} />}
                selected={colorMode === m}
                onPress={() => setColorMode(m)}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: t.space[3] }}>
          <LanguagePicker />
        </View>

        {/* TEMP A/B — calendar-strip design switcher. Remove after the decision
            (see docs/product/specs/2026-06-25-calendar-strip-ab.md). */}
        <StripVariantSwitcher />

        <View style={{ gap: t.space[3] }}>
          <AppText variant="label">{tr('yourWhenbee.label')}</AppText>
          <SettingRow
            icon="albums-outline"
            title={tr('yourWhenbee.categories.title')}
            note={tr('yourWhenbee.categories.note', { count: categoryCount })}
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
              accessibilityLabel={tr('yourWhenbee.nameInput.a11y')}
              placeholder={tr('yourWhenbee.nameInput.placeholder')}
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
            title={tr('yourWhenbee.retakeQuiz.title')}
            note={tr('yourWhenbee.retakeQuiz.note')}
            onPress={() => router.push('/(modals)/archetype-quiz')}
            accessibilityLabel={tr('yourWhenbee.retakeQuiz.a11y')}
          />
          <SettingRow
            icon="happy-outline"
            title={tr('yourWhenbee.nameCompanion.title')}
            note={tr('yourWhenbee.nameCompanion.note')}
            onPress={() => router.push('/(modals)/companion')}
          />
        </View>

        <View style={{ gap: t.space[3] }}>
          <AppText variant="label">{tr('notifications.label')}</AppText>

          {/* Master reminders toggle */}
          <SettingRow
            icon="notifications-outline"
            title={tr('notifications.reminders.title')}
            note={tr('notifications.reminders.note')}
            trailing={
              <Switch
                value={remindersEnabled}
                onValueChange={handleToggleReminders}
                trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
                accessibilityLabel={tr('notifications.reminders.a11y')}
              />
            }
          />

          {/* Per-type sub-rows — only visible when reminders are on */}
          {remindersEnabled ? (
            <>
              <SettingRow
                icon="checkmark-circle-outline"
                title={tr('notifications.honestReached.title')}
                note={tr('notifications.honestReached.note')}
                trailing={
                  <Switch
                    value={honestReachedEnabled}
                    onValueChange={setHonestReachedEnabled}
                    trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
                    accessibilityLabel={tr('notifications.honestReached.a11y')}
                  />
                }
              />
              <SettingRow
                icon="arrow-forward-circle-outline"
                title={tr('notifications.startBy.title')}
                note={tr('notifications.startBy.note')}
                trailing={
                  <Switch
                    value={startByEnabled}
                    onValueChange={setStartByEnabled}
                    trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
                    accessibilityLabel={tr('notifications.startBy.a11y')}
                  />
                }
              />
              {isPro ? (
                <SettingRow
                  icon="leaf-outline"
                  title={tr('notifications.mondayReview.title')}
                  note={tr('notifications.mondayReview.note')}
                  trailing={
                    <Switch
                      value={reviewNotifyEnabled}
                      onValueChange={handleToggleReviewNotify}
                      trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
                      accessibilityLabel={tr('notifications.mondayReview.a11y')}
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
                title={tr('notifications.quietHours.title')}
                note={tr('notifications.quietHours.note')}
                trailing={
                  <Switch
                    value={quietHours.enabled}
                    onValueChange={(v) => updateQuietHours({ enabled: v })}
                    trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
                    accessibilityLabel={tr('notifications.quietHours.a11y')}
                  />
                }
              />
              {quietHours.enabled ? (
                <>
                  <SettingRow
                    icon="time-outline"
                    title={tr('notifications.quietHours.from', {
                      time: formatClockMeridiem(dayEndEpochFor(Date.now(), quietHours.startMin)),
                    })}
                    note={tr('notifications.quietHours.fromNote')}
                    onPress={openQuietStart}
                    accessibilityLabel={tr('notifications.quietHours.fromA11y')}
                  />
                  <SettingRow
                    icon="time-outline"
                    title={tr('notifications.quietHours.until', {
                      time: formatClockMeridiem(dayEndEpochFor(Date.now(), quietHours.endMin)),
                    })}
                    note={tr('notifications.quietHours.untilNote')}
                    onPress={openQuietEnd}
                    accessibilityLabel={tr('notifications.quietHours.untilA11y')}
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
                      {tr('notifications.sound.title')}
                    </AppText>
                    <AppText
                      style={{
                        ...(type.caption as unknown as import('react-native').TextStyle),
                        color: t.colors.inkSoft,
                      }}
                    >
                      {tr('notifications.sound.note')}
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
            title={tr('notifications.dailyCheckin.title')}
            note={tr('notifications.dailyCheckin.note')}
            trailing={
              <Switch
                value={dailyRitualEnabled}
                onValueChange={setDailyRitualEnabled}
                trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
                accessibilityLabel={tr('notifications.dailyCheckin.a11y')}
              />
            }
          />

          {/* Quick-start chips — the "Tap to start again" row on Today */}
          <SettingRow
            icon="repeat-outline"
            title={tr('notifications.quickStart.title')}
            note={tr('notifications.quickStart.note')}
            trailing={
              <Switch
                value={quickStartEnabled}
                onValueChange={setQuickStartEnabled}
                trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
                accessibilityLabel={tr('notifications.quickStart.a11y')}
              />
            }
          />
        </View>

        <View style={{ gap: t.space[3] }}>
          <AppText variant="label">{tr('scheduling.label')}</AppText>
          <SettingRow
            icon="moon-outline"
            title={tr('scheduling.endOfDay.title')}
            note={
              dayEndEnabled
                ? tr('scheduling.endOfDay.noteOn', { time: dayEndLabel })
                : tr('scheduling.endOfDay.noteOff')
            }
            onPress={dayEndEnabled ? openDayEnd : undefined}
            accessibilityLabel={
              dayEndEnabled
                ? tr('scheduling.endOfDay.a11yOn', { time: dayEndLabel })
                : tr('scheduling.endOfDay.a11yOff')
            }
            trailing={
              <Switch
                value={dayEndEnabled}
                onValueChange={setDayEndEnabled}
                trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
                accessibilityLabel={tr('scheduling.endOfDay.switchA11y')}
              />
            }
          />
        </View>

        <CalendarSettingsSection />

        <View style={{ gap: t.space[3] }}>
          <AppText variant="label">{tr('data.label')}</AppText>
          <SettingRow
            icon="document-text-outline"
            title={tr('data.exportReport.title')}
            note={tr('data.exportReport.note')}
            onPress={() => router.push('/(modals)/report')}
          />
          <SettingRow
            icon="lock-closed-outline"
            title={tr('data.privacy.title')}
            note={tr('data.privacy.note')}
            onPress={() => router.push('/privacy')}
          />
        </View>

        <View style={{ gap: t.space[3] }}>
          <AppText variant="label">{tr('presence.label')}</AppText>

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
              {tr('presence.title')}
            </AppText>
            <AppText
              style={{
                ...(type.bodySm as unknown as import('react-native').TextStyle),
                color: t.colors.inkSoft,
              }}
            >
              {tr('presence.note')}
            </AppText>

            {isPresenceAvailable ? (
              <AppButton
                label={tr('presence.widgetHelpButton')}
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
                {tr('presence.availableCaption')}
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
                {tr('presence.ringOnCaption')}
              </AppText>
            </ProGate>
          </View>
        </View>

        <View style={{ gap: t.space[3] }}>
          <AppText variant="label">{tr('account.label')}</AppText>
          {isPro ? (
            <SettingRow
              icon="card-outline"
              title={tr('account.manageSubscription.title')}
              note={tr('account.manageSubscription.note')}
              onPress={manageSubscription}
            />
          ) : null}
          <SettingRow
            icon="refresh-outline"
            title={tr('account.restorePurchases.title')}
            note={tr('account.restorePurchases.note')}
            onPress={handleRestore}
            disabled={restoring}
          />
        </View>

        <View style={{ gap: t.space[3] }}>
          <AppText variant="label" style={{ color: t.colors.danger }}>
            {tr('dangerZone.label')}
          </AppText>
          <SettingRow
            leading={<DataResetGlyph kind="progress" size={t.iconSize.md} />}
            title={tr('dangerZone.resetProgress.title')}
            note={tr('dangerZone.resetProgress.note')}
            tint={t.colors.accent}
            onPress={() => setSheet('progress')}
            disabled={resetting}
          />
          <SettingRow
            leading={<DataResetGlyph kind="erase" size={t.iconSize.md} />}
            title={tr('dangerZone.eraseEverything.title')}
            note={tr('dangerZone.eraseEverything.note')}
            tint={t.colors.danger}
            onPress={() => setSheet('erase')}
            disabled={resetting}
          />
        </View>

        <View style={{ gap: t.space[3] }}>
          <AppText variant="label">{tr('developer.label')}</AppText>
          <SettingRow
            icon="construct-outline"
            title={tr('developer.unlockPro.title')}
            note={tr('developer.unlockPro.note')}
            trailing={
              <Switch
                value={isPro}
                onValueChange={setPro}
                trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
                accessibilityLabel={tr('developer.unlockPro.a11y')}
              />
            }
          />
          {__DEV__ && (
            <SettingRow
              icon="flask-outline"
              title={tr('developer.seedDemo.title')}
              note={tr('developer.seedDemo.note')}
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
        title={tr('confirmSheets.resetProgress.title')}
        bullets={[
          tr('confirmSheets.resetProgress.bullet1'),
          tr('confirmSheets.resetProgress.bullet2'),
          tr('confirmSheets.resetProgress.bullet3'),
        ]}
        confirmLabel={tr('confirmSheets.resetProgress.confirmLabel')}
        onConfirm={handleResetProgress}
        onCancel={() => setSheet(null)}
      />
      <ConfirmSheet
        visible={sheet === 'erase'}
        tone="danger"
        glyphKind="erase"
        title={tr('confirmSheets.eraseEverything.title')}
        bullets={[
          tr('confirmSheets.eraseEverything.bullet1'),
          tr('confirmSheets.eraseEverything.bullet2'),
          tr('confirmSheets.eraseEverything.bullet3'),
        ]}
        confirmLabel={tr('confirmSheets.eraseEverything.confirmLabel')}
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
            accessibilityLabel={tr('dismissA11y')}
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
              {tr('dayEndModal.title')}
            </AppText>
            <FinishTimeWheel
              showModes={false}
              valueMs={dayEndEpochFor(Date.now(), dayEndMin)}
              onChange={(ms) => saveDayEnd(ms)}
            />
            <AppButton label={tr('dayEndModal.doneButton')} onPress={closeDayEnd} variant="amber" fullWidth />
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
            accessibilityLabel={tr('dismissA11y')}
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
              {editingBoundary === 'start' ? tr('quietHoursModal.fromTitle') : tr('quietHoursModal.untilTitle')}
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
            <AppButton label={tr('quietHoursModal.doneButton')} onPress={closeQuietEditor} variant="amber" fullWidth />
          </View>
        </View>
      </Modal>

      <Toast message={toastMsg} visible={toastVisible} />
    </Screen>
  );
}
