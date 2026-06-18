// src/features/today/__tests__/RitualSeal.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { RitualSeal } from '@/src/features/today/RitualSeal';

describe('RitualSeal', () => {
  it('shows the invitation when not done and logs on press', () => {
    const onLog = jest.fn();
    render(<RitualSeal done={false} onLog={onLog} />);
    expect(screen.getByText('Log one honest thing')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Log one honest thing'));
    expect(onLog).toHaveBeenCalledTimes(1);
  });

  it('shows the sealed label when done', () => {
    render(<RitualSeal done onLog={() => {}} />);
    expect(screen.getByText("Today's honey set ✦")).toBeOnTheScreen();
  });
});
