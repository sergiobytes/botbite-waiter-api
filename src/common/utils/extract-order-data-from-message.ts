export type ProductPrototype = {
  productName: string;
  quantity: number;
  price: number | undefined;
};

export const extractOrderDataFromMessage = (
  input: string,
): ProductPrototype[] | null => {
  try {
    const items: ProductPrototype[] = [];
    const lines = input.split('\n');

    for (const line of lines) {
      const itemMatch = line.match(
        /(?:\d+\.|[-•])\s*(.+?)\s*x(\d+)(?:\s*[-–]\s*\$?([\d,]+(?:\.\d{2})?))?/i,
      );

      if (itemMatch) {
        const [, productName, quantity, price] = itemMatch;
        items.push({
          productName: productName.trim(),
          quantity: parseInt(quantity),
          price: price ? parseFloat(price.replace(',', '')) : undefined,
        });
      }
    }

    return items.length > 0 ? items : null;
  } catch (error) {
    console.error('Error extracting order data:', error);
    return null;
  }
};
