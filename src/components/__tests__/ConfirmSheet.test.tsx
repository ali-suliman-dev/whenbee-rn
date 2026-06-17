import { render, fireEvent } from '@testing-library/react-native';
import { ConfirmSheet } from '@/src/components/ConfirmSheet';

const baseProps = {
  visible: true,
  tone: 'danger' as const,
  glyphKind: 'erase' as const,
  title: 'Erase everything?',
  bullets: ['Deletes all of it.', 'Starts from the welcome screen.'],
  confirmLabel: 'Erase everything',
};

describe('ConfirmSheet', () => {
  it('renders title + bullets and fires onConfirm / onCancel', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const { getByText } = render(
      <ConfirmSheet {...baseProps} onConfirm={onConfirm} onCancel={onCancel} />,
    );
    getByText('Erase everything?');
    getByText('Deletes all of it.');
    fireEvent.press(getByText('Erase everything'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.press(getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
