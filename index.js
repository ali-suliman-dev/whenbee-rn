import 'expo-router/entry';
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  // Registered at module load so the OS can invoke it headlessly. Guarded to
  // Android; the library's native side only exists there.
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('@/src/widgets/widgetTaskHandler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
