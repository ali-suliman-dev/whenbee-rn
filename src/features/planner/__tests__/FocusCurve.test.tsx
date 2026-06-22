import { render } from '@testing-library/react-native';
import Svg from 'react-native-svg';
import { FocusCurve } from '../FocusCurve';

const SCORE_BY_BIN = Array.from({ length: 38 }, (_, i) => (i === 10 ? 1 : 0.3));

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
