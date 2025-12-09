export const extractOrderFromResponseUtil = (
  response: string,
): Record<
  string,
  { price: number; quantity: number; menuItemId: string; notes?: string }
> => {
  const order: Record<
    string,
    { price: number; quantity: number; menuItemId: string; notes?: string }
  > = {};

  const orderRegex =
    /[•-]\s*\[ID:([^\]]+)\]\s+([^:]+?)\s+\(([^)]+)\)\s*:\s*\$(\d+(?:\.\d{2})?)(?:\s*x\s*(\d+)(?:\s*=\s*\$(\d+(?:\.\d{2})?))?)?(?:\s*\[Nota:\s*([^\]]+)\])?/gi;

  let match;

  while ((match = orderRegex.exec(response)) !== null) {
    const menuItemId = match[1]?.trim();
    const fullName = match[2]?.trim().replace(/\*\*/g, '').trim();
    const price = parseFloat(match[4]);
    const quantity = match[5] ? parseInt(match[5]) : 1;
    const notes = match[7]?.trim();

    const lowerName = fullName.toLowerCase();

    if (
      lowerName === 'total' ||
      lowerName.includes('total:') ||
      lowerName.startsWith('total') ||
      lowerName.includes('subtotal') ||
      lowerName.length === 0
    ) {
      continue;
    }

    const orderKey = notes ? `${fullName}||${notes}` : fullName;

    if (order[orderKey]) order[orderKey].quantity += quantity;
    else order[orderKey] = { price, quantity, menuItemId, notes };
  }
  return order;
};
