import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { DiscoveriesGallery } from '@/src/features/whenbee/DiscoveriesGallery';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import type { Discovery } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// Discoveries route — the full banked-aha gallery. Thin: it loads the discovery
// list from the store (no business logic here) and hands it to the gallery, which
// owns the list + empty state. Reached from the hub's DiscoveriesPreviewCard.
// ──────────────────────────────────────────────────────────────────────────────

export default function DiscoveriesRoute() {
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

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Things you’ve learned' }} />
      <DiscoveriesGallery discoveries={discoveries} />
    </Screen>
  );
}
