import { render, screen, fireEvent } from '@testing-library/react-native';
import { FinishEditorSheet } from '@/src/features/routines/FinishEditorSheet';

// The wheel owns pan gestures and its own layout maths — neither is what this
// suite is about. Stub it so the header contract can be asserted in isolation.
jest.mock('@/src/features/planner/FinishTimeWheel', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { FinishTimeWheel: () => React.createElement(Text, { testID: 'finish-time-wheel' }, 'wheel') };
});

const noop = (): void => {};

describe('FinishEditorSheet', () => {
  it('titles itself Finish by by default, so existing callers are unchanged', () => {
    render(
      <FinishEditorSheet visible valueMs={null} onChange={noop} onClear={noop} onClose={noop} />,
    );
    expect(screen.getByText('Finish by')).toBeOnTheScreen();
  });

  it('names the end of the day it is setting', () => {
    render(
      <FinishEditorSheet
        visible
        title="Start at"
        valueMs={null}
        onChange={noop}
        onClear={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByText('Start at')).toBeOnTheScreen();
  });

  // "Finish by now" is meaningless — the shortcut only exists for a start.
  it('renders no Use now shortcut without an onUseNow handler', () => {
    render(
      <FinishEditorSheet visible valueMs={null} onChange={noop} onClear={noop} onClose={noop} />,
    );
    expect(screen.queryByTestId('finish-editor-use-now')).toBeNull();
  });

  it('renders Use now beside the title and fires it on press', () => {
    const onUseNow = jest.fn();
    render(
      <FinishEditorSheet
        visible
        title="Start at"
        valueMs={0}
        onChange={noop}
        onClear={noop}
        onClose={noop}
        onUseNow={onUseNow}
      />,
    );
    fireEvent.press(screen.getByTestId('finish-editor-use-now'));
    expect(onUseNow).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when hidden', () => {
    render(
      <FinishEditorSheet
        visible={false}
        valueMs={null}
        onChange={noop}
        onClear={noop}
        onClose={noop}
      />,
    );
    expect(screen.queryByTestId('finish-time-wheel')).toBeNull();
  });
});
