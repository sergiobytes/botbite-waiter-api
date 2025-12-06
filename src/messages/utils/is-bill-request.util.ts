export const isBillRequestUtil = (
  clientMessage: string,
  aiResponse: string,
): boolean => {
  const clientLower = clientMessage.toLowerCase();
  const aiResponseLower = aiResponse.toLowerCase();

  const billKeywords = [
    'la cuenta',
    'cuenta por favor',
    'quiero pagar',
    'cuánto debo',
    'cuanto debo',
    'mi cuenta',
    'pagar',
    'cuenta',
  ];

  const totalOnlyKeywords = [
    'cuánto llevo',
    'cuanto llevo',
    'cuánto va',
    'cuanto va',
    'cuánto es lo que llevo',
    'cuanto es lo que llevo',
  ];

  const isOnlyTotalRequest = totalOnlyKeywords.some((keyword) =>
    clientLower.includes(keyword),
  );

  if (isOnlyTotalRequest) {
    return false;
  }

  // Cliente pide la cuenta con palabras clave
  const clientRequestsBill = billKeywords.some((keyword) =>
    clientLower.includes(keyword),
  );

  // Respuesta del asistente contiene la confirmación de cuenta
  const responseContainsBillConfirmation =
    aiResponseLower.includes('aquí tienes tu cuenta:') &&
    aiResponseLower.includes(
      'en unos momentos se acercará alguien de nuestro personal para apoyarte con el pago',
    );

  return clientRequestsBill && responseContainsBillConfirmation;
};
