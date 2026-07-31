import { render } from '@testing-library/react-native';
import { FeatureReadinessList } from '../FeatureReadinessList';
import type { ProFeatureId } from '@/src/engine';

const READY_ID = 'confidence-band' as ProFeatureId;
const NEXT_UP_ID = 'steals-your-time' as ProFeatureId;
const WAIT_ID = 'honest-week' as ProFeatureId;

it('renders the ready pip (filled amber) with a "Ready" status for a ready item', () => {
  const { getByTestId, getByText } = render(
    <FeatureReadinessList items={[{ id: READY_ID, ready: true }]} logsToNext={3} />,
  );
  expect(getByTestId('feature-pip-ready')).toBeTruthy();
  expect(getByText('Ready')).toBeTruthy();
});

it('renders the hollow wait pip with its waitLabel for a not-ready, not-next-up item', () => {
  const { getByTestId, getByText } = render(
    <FeatureReadinessList
      items={[
        { id: READY_ID, ready: true },
        { id: NEXT_UP_ID, ready: false },
        { id: WAIT_ID, ready: false, waitLabel: 'about a week' },
      ]}
      logsToNext={3}
    />,
  );
  expect(getByTestId('feature-pip-wait')).toBeTruthy();
  expect(getByText('about a week')).toBeTruthy();
});

it('renders the partial pip with the remaining-logs number for the first not-ready item', () => {
  const { getByTestId, getByText } = render(
    <FeatureReadinessList
      items={[
        { id: READY_ID, ready: true },
        { id: NEXT_UP_ID, ready: false },
        { id: WAIT_ID, ready: false, waitLabel: 'about a week' },
      ]}
      logsToNext={3}
    />,
  );
  expect(getByTestId('feature-pip-part')).toBeTruthy();
  // The pip shows the remaining-logs number; the status mirrors the same count.
  expect(getByText('3')).toBeTruthy();
  expect(getByText('3 logs to go')).toBeTruthy();
});

it('renders all three pip types when the list contains a ready, next-up and waiting item', () => {
  const { getByTestId } = render(
    <FeatureReadinessList
      items={[
        { id: READY_ID, ready: true },
        { id: NEXT_UP_ID, ready: false },
        { id: WAIT_ID, ready: false },
      ]}
      logsToNext={1}
    />,
  );
  expect(getByTestId('feature-pip-ready')).toBeTruthy();
  expect(getByTestId('feature-pip-part')).toBeTruthy();
  expect(getByTestId('feature-pip-wait')).toBeTruthy();
});
