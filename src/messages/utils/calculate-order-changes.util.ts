export const calculateOrderChangesUtil = (
  lastOrder: Record<
    string,
    { price: number; quantity: number; menuItemId: string; notes?: string }
  >,
  currentOrder: Record<
    string,
    { price: number; quantity: number; menuItemId: string; notes?: string }
  >,
): Record<
  string,
  { price: number; quantity: number; menuItemId: string; notes?: string }
> => {
  const changes: Record<
    string,
    { price: number; quantity: number; menuItemId: string; notes?: string }
  > = {};

  for (const [productKey, current] of Object.entries(currentOrder)) {
    const last = lastOrder[productKey];

    if (!last) {
      changes[productKey] = current;
    } else if (current.quantity > last.quantity) {
      changes[productKey] = {
        price: current.price,
        quantity: current.quantity - last.quantity,
        menuItemId: current.menuItemId,
        notes: current.notes,
      };
    }
  }

  return changes;
};
