import { render, fireEvent } from '@testing-library/react-native';
import { ManageAreaCard } from '@/src/features/category-detail/ManageAreaCard';
import { ConfirmSheet } from '@/src/components/ConfirmSheet';

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

  it('delete row opens the delete confirm; confirming fires onConfirmDelete once', () => {
    const onConfirmDelete = jest.fn();
    const utils = render(
      <ManageAreaCard {...base} canDelete onConfirmDelete={onConfirmDelete} />,
    );
    const deleteSheet = () =>
      utils.UNSAFE_getAllByType(ConfirmSheet).find((n) => n.props.tone === 'danger');

    // closed until the row is pressed — proves the row→sheet wiring
    expect(deleteSheet()!.props.visible).toBe(false);
    fireEvent.press(utils.getByLabelText('Delete area')); // the row
    expect(deleteSheet()!.props.visible).toBe(true);

    // confirming fires the callback exactly once
    const confirmBtn = utils.getAllByText('Delete area').at(-1)!;
    fireEvent.press(confirmBtn);
    expect(onConfirmDelete).toHaveBeenCalledTimes(1);
  });
});
