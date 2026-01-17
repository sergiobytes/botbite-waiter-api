export const isInitialOrderConfirmationUtil = (aiResponse: string): boolean => {
  const responseLower = aiResponse.toLowerCase();

  // Buscar variantes del mensaje de confirmación en diferentes idiomas
  const confirmationPhrases = [
    // Español - variantes
    'perfecto, gracias por confirmar, tu pedido está ahora en proceso',
    'gracias por confirmar',
    'tu pedido está ahora en proceso',
    'tu pedido está en proceso',
    'tu pedido está completo',
    'perfecto! aquí tienes el resumen final',
    'aquí tienes el resumen final de las cuentas',
    'será preparado en breve',

    // Inglés - variantes
    'perfect, thank you for confirming, your order is now being processed',
    'thank you for confirming',
    'your order is now being processed',
    'your order is complete',
    'here is your final summary',
    'will be prepared shortly',

    // Francés - variantes
    'parfait, merci de confirmer, votre commande est maintenant en cours de traitement',
    'merci de confirmer',
    'votre commande est maintenant en cours',
    'votre commande est complète',

    // Coreano
    '완벽합니다. 확인해 주셔서 감사합니다. 주문이 이제 처리 중입니다',
  ];

  // Verificar que contenga alguna frase de confirmación
  const hasConfirmationPhrase = confirmationPhrases.some((phrase) =>
    responseLower.includes(phrase),
  );

  // Si tiene "tu pedido está completo/en proceso" o "será preparado", es confirmación directa
  const isDirectConfirmation =
    responseLower.includes('tu pedido está completo') ||
    responseLower.includes('tu pedido está ahora en proceso') ||
    responseLower.includes('he confirmado tu pedido') ||
    responseLower.includes('será preparado') ||
    responseLower.includes('lo estarán preparando') ||
    responseLower.includes('your order is complete') ||
    responseLower.includes('your order is now being processed') ||
    responseLower.includes('i have confirmed your order') ||
    responseLower.includes('will be prepared') ||
    responseLower.includes('votre commande est complète') ||
    responseLower.includes('votre commande est maintenant en cours') ||
    responseLower.includes("j'ai confirmé votre commande");

  // Para confirmaciones directas, no requerimos productos en el mensaje
  if (isDirectConfirmation) {
    return true;
  }

  // Para otras frases de confirmación, verificar que tenga productos y totales
  const hasProductsWithIds = /\[ID:[^\]]+\]/.test(aiResponse);
  const hasTotalOrSubtotal =
    responseLower.includes('total') || responseLower.includes('subtotal');

  return hasConfirmationPhrase && hasProductsWithIds && hasTotalOrSubtotal;
};
