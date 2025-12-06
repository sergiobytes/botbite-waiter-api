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

  const clientRequestsBill = billKeywords.some((keyword) =>
    clientLower.includes(keyword),
  );

  const responseContainsBillConfirmation =
    (aiResponseLower.includes('aquí tienes tu cuenta:') ||
      aiResponseLower.includes('aqui tienes tu cuenta:') ||
      aiResponseLower.includes('here is your bill:') ||
      aiResponseLower.includes('voici votre addition:') ||
      aiResponseLower.includes('계산서입니다:')) &&
    (aiResponseLower.includes(
      'en unos momentos se acercará alguien de nuestro personal para apoyarte con el pago',
    ) ||
      aiResponseLower.includes(
        'someone from our staff will be with you shortly to assist with payment',
      ) ||
      aiResponseLower.includes(
        "quelqu'un de notre personnel viendra vous aider avec le paiement",
      ) ||
      aiResponseLower.includes('곧 직원이 결제를 도와드리러 갈 것입니다'));

  return clientRequestsBill && responseContainsBillConfirmation;
};
