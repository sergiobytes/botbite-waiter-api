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

  // Palabras que indican que el cliente está PIDIENDO productos, no confirmando
  const productRequestKeywords = [
    'agrega',
    'agregame',
    'añade',
    'añademe',
    'dame',
    'deme',
    'quiero',
    'queremos',
    'me das',
    'me da',
    'tráeme',
    'traeme',
    'necesito',
    'pido',
    'pideme',
    'también',
    'tambien',
    'otro',
    'otra',
    'más',
    'mas',
    'add',
    'give me',
    'i want',
    'i need',
    'i\'d like',
    'bring me',
    'another',
    'more',
    'also',
  ];

  // Si el mensaje contiene palabras de solicitud de productos, NO es una confirmación
  const isRequestingProducts = productRequestKeywords.some((keyword) =>
    clientLower.includes(keyword),
  );

  if (isRequestingProducts) {
    return false;
  }

  const clientConfirms = confirmationKeywords.some((keyword) =>
    clientLower.includes(keyword),
  );

  const aiAskForMore =
    aiResponseLower.includes('deseas agregar algo más') ||
    aiResponseLower.includes('would you like to add something else') ||
    aiResponseLower.includes('souhaitez-vous ajouter autre chose') ||
    aiResponseLower.includes('다른 것을 추가하시겠습니까') ||
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
