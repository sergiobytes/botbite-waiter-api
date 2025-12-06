export const detectInvalidTableResponseUtil = (message: string): boolean => {
  const lowerMessage = message.toLowerCase().trim();

  const invalidTableResponses = [
    /mesa\s+(hola|mundo|test|prueba|abc|xyz)/,
    /en\s+la\s+mesa\s+(hola|mundo|test|prueba)/,
  ];

  const hasInvalidTableResponse = invalidTableResponses.some((pattern) =>
    pattern.test(lowerMessage),
  );

  return hasInvalidTableResponse;
};