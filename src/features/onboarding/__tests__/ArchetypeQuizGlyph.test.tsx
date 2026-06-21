import { render } from '@testing-library/react-native';
import { ArchetypeQuizGlyph, type QuizGlyphKind } from '../ArchetypeQuizGlyph';

const kinds: QuizGlyphKind[] = [
  'pace_about',
  'pace_bit',
  'pace_lot',
  'pace_lose',
  'mid_track',
  'mid_rabbit',
  'focus_morning',
  'focus_evening',
  'focus_varies',
];

it('renders every glyph kind without crashing, active and inactive', () => {
  for (const kind of kinds) {
    expect(render(<ArchetypeQuizGlyph kind={kind} active={false} />).toJSON()).toBeTruthy();
    expect(render(<ArchetypeQuizGlyph kind={kind} active />).toJSON()).toBeTruthy();
  }
});
