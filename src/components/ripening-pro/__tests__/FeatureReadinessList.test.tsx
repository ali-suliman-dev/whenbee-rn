import { render } from '@testing-library/react-native';
import { FeatureReadinessList } from '../FeatureReadinessList';
import type { ProFeatureId } from '@/src/engine';

const READY_ID = 'confidence-band' as ProFeatureId;
const RIPENING_ID = 'honest-week' as ProFeatureId;

it('renders the ready pip (filled amber) for a ready item', () => {
  const { getByTestId } = render(
    <FeatureReadinessList
      items={[{ id: READY_ID, ready: true }]}
    />,
  );
  expect(getByTestId('feature-pip-ready')).toBeTruthy();
});

it('renders the ripening pip (hollow ring) for a not-ready item', () => {
  const { getByTestId } = render(
    <FeatureReadinessList
      items={[{ id: RIPENING_ID, ready: false, waitLabel: 'Soon' }]}
    />,
  );
  expect(getByTestId('feature-pip-ripening')).toBeTruthy();
});

it('renders both pip types when the list contains mixed items', () => {
  const { getByTestId } = render(
    <FeatureReadinessList
      items={[
        { id: READY_ID, ready: true },
        { id: RIPENING_ID, ready: false },
      ]}
    />,
  );
  expect(getByTestId('feature-pip-ready')).toBeTruthy();
  expect(getByTestId('feature-pip-ripening')).toBeTruthy();
});
