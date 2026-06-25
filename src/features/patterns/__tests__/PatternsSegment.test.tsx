import { render, fireEvent, screen } from '@testing-library/react-native';
import { PatternsSegment } from '../PatternsSegment';

// ──────────────────────────────────────────────────────────────────────────────
// PatternsSegment — 3-option segmented control [Numbers · Insights · Correlations]
// ──────────────────────────────────────────────────────────────────────────────

describe('PatternsSegment', () => {
  it('renders all 3 segment labels', () => {
    const onChange = jest.fn();
    render(<PatternsSegment value="numbers" onChange={onChange} />);

    expect(screen.getByText('Numbers')).toBeTruthy();
    expect(screen.getByText('Insights')).toBeTruthy();
    expect(screen.getByText('Correlations')).toBeTruthy();
  });

  it('calls onChange with "numbers" when Numbers tapped', () => {
    const onChange = jest.fn();
    render(<PatternsSegment value="insights" onChange={onChange} />);

    fireEvent.press(screen.getByText('Numbers'));
    expect(onChange).toHaveBeenCalledWith('numbers');
  });

  it('calls onChange with "insights" when Insights tapped', () => {
    const onChange = jest.fn();
    render(<PatternsSegment value="numbers" onChange={onChange} />);

    fireEvent.press(screen.getByText('Insights'));
    expect(onChange).toHaveBeenCalledWith('insights');
  });

  it('calls onChange with "correlations" when Correlations tapped', () => {
    const onChange = jest.fn();
    render(<PatternsSegment value="numbers" onChange={onChange} />);

    fireEvent.press(screen.getByText('Correlations'));
    expect(onChange).toHaveBeenCalledWith('correlations');
  });

  it('marks the active option as selected via accessibilityState', () => {
    render(<PatternsSegment value="insights" onChange={jest.fn()} />);

    // The selected option has accessibilityState.selected=true; others are false.
    const numbers = screen.getByRole('button', { name: 'Numbers' });
    const insights = screen.getByRole('button', { name: 'Insights' });
    const correlations = screen.getByRole('button', { name: 'Correlations' });

    expect(numbers).toHaveProp('accessibilityState', { selected: false });
    expect(insights).toHaveProp('accessibilityState', { selected: true });
    expect(correlations).toHaveProp('accessibilityState', { selected: false });
  });

  it('responds to value prop change — new selection reflected in accessibilityState', () => {
    const onChange = jest.fn();
    const { rerender } = render(<PatternsSegment value="numbers" onChange={onChange} />);

    rerender(<PatternsSegment value="correlations" onChange={onChange} />);

    const numbers = screen.getByRole('button', { name: 'Numbers' });
    const correlations = screen.getByRole('button', { name: 'Correlations' });

    expect(numbers).toHaveProp('accessibilityState', { selected: false });
    expect(correlations).toHaveProp('accessibilityState', { selected: true });
  });
});
