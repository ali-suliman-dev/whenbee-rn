// The capture sheet asks the same question add-task does ("what did you work
// on?"), so it gets the same on-device voice affordance. It used to render a
// bare TextInput — the one place where naming a thing you have just finished
// doing had to be typed.

import { render, screen, fireEvent } from '@testing-library/react-native';
import { PostStopCaptureSheet } from '@/src/components/quick/PostStopCaptureSheet';

// TaskTitleField reads screen focus through expo-router's useNavigation.
jest.mock('expo-router', () => ({
  useNavigation: () => ({ isFocused: () => true, addListener: () => () => {} }),
}));

const renderSheet = (overrides: Partial<Parameters<typeof PostStopCaptureSheet>[0]> = {}) =>
  render(
    <PostStopCaptureSheet
      label=""
      onLabelChange={jest.fn()}
      category={null}
      onCategoryChange={jest.fn()}
      onSave={jest.fn()}
      onSkip={jest.fn()}
      {...overrides}
    />,
  );

describe('PostStopCaptureSheet', () => {
  it('offers voice on the task-name field', () => {
    renderSheet();
    expect(screen.getByLabelText('Speak your task')).toBeTruthy();
  });

  it('still types through to the caller — voice is an addition, not a replacement', () => {
    const onLabelChange = jest.fn();
    renderSheet({ onLabelChange });
    fireEvent.changeText(screen.getByLabelText('Task name'), 'Tidied the kitchen');
    expect(onLabelChange).toHaveBeenCalledWith('Tidied the kitchen');
  });

  it('keeps both exits reachable', () => {
    const onSkip = jest.fn();
    renderSheet({ onSkip });
    fireEvent.press(screen.getByText('Skip for now'));
    expect(onSkip).toHaveBeenCalled();
  });
});
