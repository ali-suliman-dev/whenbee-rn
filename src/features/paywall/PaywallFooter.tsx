import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { LEGAL } from '@/src/lib/legal';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// PaywallFooter — the single quiet footer group under the CTA: one reassurance
// line, the calibration trust line, the renewal disclosure, and ONE muted link
// row (Restore · Terms · Privacy — Apple 3.1.2 satisfied). "Manage subscription"
// lives in Settings, never here.
// ──────────────────────────────────────────────────────────────────────────────

export function PaywallFooter({
  isLifetime,
  restoreDisabled,
  onRestore,
}: {
  isLifetime: boolean;
  restoreDisabled: boolean;
  onRestore: () => void;
}) {
  const t = useTheme();

  const wrap: ViewStyle = { alignItems: 'center', gap: t.space[2.5], paddingTop: t.space[0.5] };
  const reassure: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
    fontFamily: 'Jakarta-SemiBold',
    textAlign: 'center',
  };
  const trust: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
    textAlign: 'center',
  };
  const trustStrong: TextStyle = { fontFamily: 'Jakarta-Bold', color: t.colors.ink };
  const renew: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
    textAlign: 'center',
  };
  const linkRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const link: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
    fontFamily: 'Jakarta-Bold',
  };
  const dot: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint };

  return (
    <View style={wrap}>
      <Text style={reassure}>
        {isLifetime ? 'One payment. No renewals, ever.' : 'No payment now. Cancel anytime.'}
      </Text>
      <Text style={trust}>
        <Text style={trustStrong}>Calibration stays free, always.</Text> Pro just adds the payoff.
      </Text>
      {isLifetime ? null : <Text style={renew}>Plans renew until cancelled.</Text>}
      <View style={linkRow}>
        <Pressable
          onPress={onRestore}
          disabled={restoreDisabled}
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
          accessibilityState={{ disabled: restoreDisabled }}
          hitSlop={t.size.hitSlop}
        >
          <Text style={link}>Restore Purchases</Text>
        </Pressable>
        <Text style={dot}>·</Text>
        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(LEGAL.termsUrl)}
          accessibilityRole="link"
          accessibilityLabel="Terms of Use"
          hitSlop={t.size.hitSlop}
        >
          <Text style={link}>Terms</Text>
        </Pressable>
        <Text style={dot}>·</Text>
        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(LEGAL.privacyUrl)}
          accessibilityRole="link"
          accessibilityLabel="Privacy Policy"
          hitSlop={t.size.hitSlop}
        >
          <Text style={link}>Privacy</Text>
        </Pressable>
      </View>
    </View>
  );
}
