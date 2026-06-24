import { render, fireEvent } from '@testing-library/react-native';
import { TimeStyleQuiz } from '../TimeStyleQuiz';

it('collects answers and completes with at least the pace', () => {
  const onComplete = jest.fn();
  const { getByText } = render(<TimeStyleQuiz onComplete={onComplete} onSkip={jest.fn()} />);
  fireEvent.press(getByText('A bit longer'));   // Q1
  fireEvent.press(getByText('Stay on track'));  // Q2
  fireEvent.press(getByText('Mornings'));        // Q3
  fireEvent.press(getByText('See my type'));     // finish
  expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ pace: 'bit', mid: 'track', focus: 'morning' }));
});

it('can complete from just the first question', () => {
  const onComplete = jest.fn();
  const { getByText } = render(<TimeStyleQuiz onComplete={onComplete} onSkip={jest.fn()} />);
  fireEvent.press(getByText('I lose track'));
  fireEvent.press(getByText('See my type'));
  expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ pace: 'lose' }));
});
