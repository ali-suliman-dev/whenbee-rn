import { render } from '@testing-library/react-native';
import Svg, { Line } from 'react-native-svg';
import { FW_BIN_COUNT } from '@/src/engine';
import { FocusCurve } from '../FocusCurve';

const SCORE_BY_BIN = Array.from({ length: FW_BIN_COUNT }, (_, i) => (i === 10 ? 1 : 0.3));

test('forming variant renders Svg', () => {
  const { UNSAFE_getByType } = render(
    <FocusCurve scoreByBin={SCORE_BY_BIN} variant="forming" />
  );
  expect(UNSAFE_getByType(Svg)).toBeTruthy();
});

test('learned variant renders with window band', () => {
  const { UNSAFE_getByType } = render(
    <FocusCurve scoreByBin={SCORE_BY_BIN} variant="learned" windowStartMin={600} windowEndMin={690} />
  );
  expect(UNSAFE_getByType(Svg)).toBeTruthy();
});

test('locked variant renders Svg', () => {
  const { UNSAFE_getByType } = render(
    <FocusCurve scoreByBin={SCORE_BY_BIN} variant="locked" />
  );
  expect(UNSAFE_getByType(Svg)).toBeTruthy();
});

it('renders Hi/Low Y labels when yAxis is set', () => {
  const { getByText } = render(
    <FocusCurve scoreByBin={SCORE_BY_BIN} variant="learned" windowStartMin={810} windowEndMin={960} yAxis />,
  );
  expect(getByText('Hi')).toBeTruthy();
  expect(getByText('Low')).toBeTruthy();
});

it('omits Y labels by default', () => {
  const { queryByText } = render(<FocusCurve scoreByBin={SCORE_BY_BIN} variant="learned" />);
  expect(queryByText('Hi')).toBeNull();
});

test('coarse bandVariant renders dashed edge lines; precise (default) renders none', () => {
  const { UNSAFE_queryAllByType, rerender } = render(
    <FocusCurve scoreByBin={SCORE_BY_BIN} variant="learned" windowStartMin={600} windowEndMin={690} bandVariant="coarse" />
  );
  expect(UNSAFE_queryAllByType(Line)).toHaveLength(2);

  rerender(
    <FocusCurve scoreByBin={SCORE_BY_BIN} variant="learned" windowStartMin={600} windowEndMin={690} />
  );
  expect(UNSAFE_queryAllByType(Line)).toHaveLength(0);
});
