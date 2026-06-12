import { View } from 'react-native';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';

export default function Activity() {
  return (<Screen><View style={{ paddingTop: 16 }}><AppText variant="display">Activity</AppText></View></Screen>);
}
