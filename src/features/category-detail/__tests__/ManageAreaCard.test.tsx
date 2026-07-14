import { render, fireEvent } from '@testing-library/react-native';
import { ManageAreaCard } from '@/src/features/category-detail/ManageAreaCard';

const base = {
  categoryName: 'Cooking',
  onConfirmReset: jest.fn(),
  onConfirmDelete: jest.fn(),
};

describe('ManageAreaCard', () => {
  it('hides the Delete row when canDelete is false', () => {
    const { queryByText, getByText } = render(<ManageAreaCard {...base} canDelete={false} />);
    expect(getByText('Reset learning')).toBeTruthy();
    expect(queryByText('Delete area')).toBeNull();
  });

  it('shows the Delete row when canDelete is true', () => {
    const { getByText } = render(<ManageAreaCard {...base} canDelete />);
    expect(getByText('Delete area')).toBeTruthy();
  });

  it('opens the delete confirm and fires onConfirmDelete', () => {
    const onConfirmDelete = jest.fn();
    const { getByLabelText, getAllByText } = render(
      <ManageAreaCard {...base} canDelete onConfirmDelete={onConfirmDelete} />,
    );
    fireEvent.press(getByLabelText('Delete area')); // opens ConfirmSheet
    // "Delete area" labels both the row and the sheet's confirm button — the
    // confirm button is the last match in render order.
    const matches = getAllByText('Delete area');
    fireEvent.press(matches[matches.length - 1]);
    expect(onConfirmDelete).toHaveBeenCalledTimes(1);
  });
});
