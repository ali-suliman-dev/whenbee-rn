import { render, fireEvent } from '@testing-library/react-native';
import { TimeStyleQuiz } from '../TimeStyleQuiz';

it('collects answers through all 4 questions and completes', () => {
  const onComplete = jest.fn();
  const { getByText } = render(<TimeStyleQuiz onComplete={onComplete} onSkip={jest.fn()} />);
  fireEvent.press(getByText('A bit longer'));      // Q1 pace=bit
  fireEvent.press(getByText('Stay on track'));     // Q2 mid=track
  fireEvent.press(getByText('Chores'));            // Q3 sink=chores
  fireEvent.press(getByText('Mornings'));          // Q4 focus=morning
  fireEvent.press(getByText('See my type'));       // finish
  expect(onComplete).toHaveBeenCalledWith(
    expect.objectContaining({ pace: 'bit', mid: 'track', sink: 'chores', focus: 'morning' }),
  );
});

it('can complete from just the first question (pace only)', () => {
  const onComplete = jest.fn();
  const { getByText } = render(<TimeStyleQuiz onComplete={onComplete} onSkip={jest.fn()} />);
  fireEvent.press(getByText('I lose track'));
  fireEvent.press(getByText('See my type'));
  expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ pace: 'lose' }));
});
