import { Tabs } from 'expo-router';
import { WhenbeeTabBar } from '@/src/components/WhenbeeTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <WhenbeeTabBar {...props} />}
      screenOptions={{
        // No native header — each screen renders the shared left-aligned
        // ScreenHeader instead (one nav style, title hard-left, no duplicate).
        headerShown: false,
      }}
    >
      {/* No `title` here on purpose. Expo Router evaluates screen options
          outside React, so a title set here can never follow the app language.
          WhenbeeTabBar translates each tab label from the route name instead
          (see TAB_TITLE_KEYS). These entries stay only to fix tab order. */}
      <Tabs.Screen name="index" />
      <Tabs.Screen name="routines" />
      <Tabs.Screen name="whenbee" />
      <Tabs.Screen name="patterns" />
    </Tabs>
  );
}
