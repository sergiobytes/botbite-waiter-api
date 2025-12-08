export const containsTableInfo = (content: string): boolean => {
  const lowerContent = content.toLowerCase().trim();

  const tablePatterns = [
    /mesa/,
    /^\d+$/,
    /terraza|barra|patio/,
    /ubicacion|ubicación/,
  ];

  return tablePatterns.some((pattern) => pattern.test(lowerContent));
};
