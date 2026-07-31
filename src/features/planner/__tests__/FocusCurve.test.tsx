import { render } from '@testing-library/react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { FW_BIN_COUNT, FW_BIN_MIN, FW_WAKING_START_MIN } from '@/src/engine';
import { tokens } from '@/src/theme/tokens';
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

test('peak dot lands on the bin whose center is peakMin, not one bin late', () => {
  const peakBinIndex = 9;
  const scoreByBin = Array.from({ length: FW_BIN_COUNT }, (_, i) => (i === peakBinIndex ? 1 : 0.3));
  // peakMin is a bin-CENTER minute, mirroring engine/focusWindowInsights.ts:
  // FW_WAKING_START_MIN + peakIdx*FW_BIN_MIN + FW_BIN_MIN/2.
  const peakMin = FW_WAKING_START_MIN + peakBinIndex * FW_BIN_MIN + FW_BIN_MIN / 2;

  const { UNSAFE_queryAllByType } = render(
    <FocusCurve scoreByBin={scoreByBin} variant="learned" peakMin={peakMin} />
  );

  const { viewW } = tokens.focusCurve;
  const x = (i: number) => (i / (FW_BIN_COUNT - 1)) * viewW;
  const expectedCx = x(peakBinIndex);
  const wrongCx = x(peakBinIndex + 1);

  const circles = UNSAFE_queryAllByType(Circle);
  expect(circles).toHaveLength(1);
  expect(circles[0]?.props.cx).toBeCloseTo(expectedCx);
  expect(circles[0]?.props.cx).not.toBeCloseTo(wrongCx);
});
