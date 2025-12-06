export const isProductUpdateUtil = (
  clientMessage: string,
  aiResponse: string,
): boolean => {
  const confirmationKeywords = [
    'si',
    'sí',
    'yes',
    'correcto',
    'correct',
    'ok',
    'está bien',
    'asi esta bien',
    'así está bien',
    'perfecto',
    'de acuerdo',
    'exacto',
  ];

  const clientLower = clientMessage.toLowerCase();
  const aiResponseLower = aiResponse.toLowerCase();

  const clientConfirms = confirmationKeywords.some((keyword) =>
    clientLower.includes(keyword),
  );

  const aiAskForMore =
    aiResponseLower.includes(
      'es correcta la orden o te gustaría agregar algo más',
    ) ||
    aiResponseLower.includes('te gustaría agregar algo más') ||
    aiResponseLower.includes('hay algo más que te gustaría ordenar') ||
    aiResponseLower.includes('algo más que pueda ayudarte');

  const aiConfirmsOrder =
    aiResponseLower.includes('perfecto, gracias por confirmar') ||
    aiResponseLower.includes('gracias por confirmar');

  const isInitialConfirmation = aiResponseLower.includes(
    'tu pedido está ahora en proceso',
  );

  return (
    clientConfirms &&
    (aiAskForMore || aiConfirmsOrder) &&
    !isInitialConfirmation
  );
};
