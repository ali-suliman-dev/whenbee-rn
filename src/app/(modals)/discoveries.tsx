import { useEffect, useState } from 'react';
import { View, Text, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/src/components/Screen';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { DiscoveriesGallery } from '@/src/features/whenbee/DiscoveriesGallery';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { Discovery } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// Discoveries route — the full banked-aha gallery. Thin: it loads the discovery
// list from the store (no business logic here) and hands it to the gallery, which
// owns the list + empty state. Reached from the hub's DiscoveriesPreviewCard.
// ──────────────────────────────────────────────────────────────────────────────

export default function DiscoveriesRoute() {
  const t = useTheme();
  const { t: tr } = useTranslation('whenbee');
  const loadDiscoveries = useCalibrationStore((s) => s.loadDiscoveries);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);

  useEffect(() => {
    let active = true;
    void loadDiscoveries().then((result) => {
      if (active) setDiscoveries(result.discoveries);
    });
    return () => {
      active = false;
    };
  }, [loadDiscoveries]);

  const heading: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const sub: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft, marginTop: t.space[1] };

  return (
    <Screen>
      <SheetGrabber />
      <View style={{ paddingTop: t.space[6], paddingBottom: t.space[4] }}>
        <Text style={heading}>{tr('discoveriesRoute.heading')}</Text>
        {discoveries.length > 0 ? (
          <Text style={sub}>{tr('discoveriesRoute.sub', { count: discoveries.length })}</Text>
        ) : null}
      </View>
      <DiscoveriesGallery discoveries={discoveries} />
    </Screen>
  );
}
