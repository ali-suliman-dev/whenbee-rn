import { View, Text, ScrollView, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { isExpoGo } from '@/src/lib/isExpoGo';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';

// ──────────────────────────────────────────────────────────────────────────────
// Paywall (formSheet) — seamless dark grab-handle sheet (no white nav header), the
// same pattern as add-task. Pro unlocks Honest-Day: your real buffers written into
// every calendar event so the day actually fits. Pricing is read from RevenueCat
// in a dev/EAS build; Expo Go simulates the unlock.
// ──────────────────────────────────────────────────────────────────────────────

export default function Paywall() {
  const t = useTheme();
  const setPro = useEntitlement((s) => s.setPro);

  const heading: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const sub: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: t.space[5], paddingTop: t.space[3], paddingBottom: t.space[6] }}
        showsVerticalScrollIndicator={false}
      >
        <SheetGrabber />

        <View style={{ gap: t.space[1] }}>
          <Text style={heading}>Go Pro</Text>
          <Text style={sub}>Honest-Day pads every calendar event with your real buffers, so the day fits.</Text>
        </View>

        <Card>
          <AppText variant="body">
            Whenbee learns how long things actually take you, then quietly adds that to your
            calendar, so you stop stacking back-to-back days that were never going to fit.
          </AppText>
        </Card>

        {isExpoGo ? (
          <AppText variant="caption">Running in Expo Go — purchases are simulated.</AppText>
        ) : null}

        <AppButton
          label={isExpoGo ? 'Simulate unlock (Expo Go)' : 'Start free trial'}
          variant="indigo"
          fullWidth
          onPress={() => {
            if (isExpoGo) setPro(true);
            router.back();
          }}
        />
      </ScrollView>
    </Screen>
  );
}
