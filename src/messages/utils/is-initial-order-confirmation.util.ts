export const isInitialOrderConfirmationUtil = (aiResponse: string): boolean => {
  const responseLower = aiResponse.toLowerCase();

  return (
    responseLower.includes(
      'perfecto, gracias por confirmar, tu pedido está ahora en proceso',
    ) ||
    responseLower.includes(
      'perfect, thank you for confirming, your order is now being processed',
    ) ||
    responseLower.includes(
      'parfait, merci de confirmer, votre commande est maintenant en cours de traitement',
    ) ||
    responseLower.includes('완벽합니다. 확인해 주셔서 감사합니다. 주문이 이제 처리 중입니다')
  );
};
