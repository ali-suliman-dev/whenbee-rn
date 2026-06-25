import { render, screen, fireEvent } from '@testing-library/react-native';
import { TodayEmptyState } from '@/src/features/today/TodayEmptyState';

describe('TodayEmptyState', () => {
  it('renders first-run copy and fires the primary CTA', () => {
    const onPrimary = jest.fn();
    render(
      <TodayEmptyState variant="first-run" onPrimary={onPrimary} onLog={() => {}} />,
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

  it('renders daily copy without a reclaim line and fires log', () => {
    const onLog = jest.fn();
    render(
      <TodayEmptyState variant="daily" onPrimary={() => {}} onLog={onLog} />,
    );
    expect(screen.getByText('Nothing on yet')).toBeOnTheScreen();
    expect(screen.getByText("What's on today?")).toBeOnTheScreen();
    expect(screen.queryByText(/reclaimed so far/)).toBeNull();
    fireEvent.press(screen.getByText('Or log something you finished'));
    expect(onLog).toHaveBeenCalledTimes(1);
  });

  it('renders future variant with weekday heading and no guilt language', () => {
    const onPrimary = jest.fn();
    render(
      <TodayEmptyState variant="future" weekday="Thursday" onPrimary={onPrimary} onLog={() => {}} />,
    );
    expect(screen.getByText("Thursday's wide open")).toBeOnTheScreen();
    expect(
      screen.getByText("Add what future-you should tackle — it carries over free if life happens."),
    ).toBeOnTheScreen();
    // no guilt/overdue language
    expect(screen.queryByText(/overdue/i)).toBeNull();
    expect(screen.queryByText(/missed/i)).toBeNull();
    fireEvent.press(screen.getByText('Plan ahead'));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });
});
