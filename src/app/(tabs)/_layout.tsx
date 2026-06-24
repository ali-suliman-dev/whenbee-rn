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
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="routines" options={{ title: 'Routines' }} />
      <Tabs.Screen name="whenbee" options={{ title: 'Whenbee' }} />
      <Tabs.Screen name="patterns" options={{ title: 'Patterns' }} />
    </Tabs>
  );
}
