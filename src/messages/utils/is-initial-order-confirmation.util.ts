export const isInitialOrderConfirmationUtil = (aiResponse: string): boolean => {
  const responseLower = aiResponse.toLowerCase();

  return responseLower.includes(
    'perfecto, gracias por confirmar, tu pedido está ahora en proceso',
  );
};
