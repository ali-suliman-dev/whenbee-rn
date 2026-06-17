import { render, screen, fireEvent } from '@testing-library/react-native';
import { TodayEmptyState } from '@/src/features/today/TodayEmptyState';

describe('TodayEmptyState', () => {
  it('renders first-run copy and fires the primary CTA', () => {
    const onPrimary = jest.fn();
    render(
      <TodayEmptyState variant="first-run" reclaimLifetimeMin={0} onPrimary={onPrimary} onLog={() => {}} />,
    );
    expect(screen.getByText('Time your first task')).toBeOnTheScreen();
    expect(
      screen.getByText(
        "That's all it takes for Whenbee to start learning your real numbers, the ones you can plan around.",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/reclaimed so far/)).toBeNull();
    fireEvent.press(screen.getByText('Start now'));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it('renders daily copy with the lifetime reclaim line and fires log', () => {
    const onLog = jest.fn();
    render(
      <TodayEmptyState variant="daily" reclaimLifetimeMin={860} onPrimary={() => {}} onLog={onLog} />,
    );
    expect(screen.getByText('Nothing on yet')).toBeOnTheScreen();
    expect(screen.getByText("What's on today?")).toBeOnTheScreen();
    expect(screen.getByText('14h 20m reclaimed so far')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Or log something you finished'));
    expect(onLog).toHaveBeenCalledTimes(1);
  });

  it('hides the reclaim line on a daily day with nothing banked', () => {
    render(<TodayEmptyState variant="daily" reclaimLifetimeMin={0} onPrimary={() => {}} onLog={() => {}} />);
    expect(screen.queryByText(/reclaimed so far/)).toBeNull();
  });
});
