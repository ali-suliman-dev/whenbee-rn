import { render } from '@testing-library/react-native';
import { DriftNote } from '../DriftAlert';

it('describes a category taking longer lately', () => {
  const { getByText } = render(
    <DriftNote card={{ categoryId: 'admin', categoryName: 'Admin', earlyMultiplier: 1.6, recentMultiplier: 2.0, slowerLately: true }} />,
  );
  expect(getByText(/Admin/)).toBeTruthy();
  expect(getByText(/longer lately/)).toBeTruthy();
});
