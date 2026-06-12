import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/useTheme';
import { AnimatedTabIcon, TabBarButton } from '@/src/components/TabBarButton';

export default function TabsLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.inkSoft,
        tabBarButton: (props) => <TabBarButton {...props} />,
        tabBarStyle: {
          backgroundColor: t.colors.surface,
          borderTopWidth: 1,
          borderTopColor: t.colors.hairline,
          // Reserve the home-indicator inset so labels never sit under it.
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        // No native header — each screen renders the shared left-aligned
        // ScreenHeader instead (one nav style, title hard-left, no duplicate).
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ size, focused }) => (
            <AnimatedTabIcon name="home" size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ size, focused }) => (
            <AnimatedTabIcon name="calendar" size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="whenbee"
        options={{
          title: 'Whenbee',
          tabBarIcon: ({ size, focused }) => (
            <AnimatedTabIcon name="bug" size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="patterns"
        options={{
          title: 'Patterns',
          tabBarIcon: ({ size, focused }) => (
            <AnimatedTabIcon name="pulse" size={size} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
