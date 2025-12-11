/**
 * Detecta si el cliente está respondiendo con un método de pago
 * después de que se le pidió la cuenta y se le preguntó cómo quiere pagar
 */
export const isPaymentMethodResponseUtil = (
  clientMessage: string,
  aiResponse: string,
): { isPaymentMethod: boolean; paymentMethod: string | null } => {
  const clientLower = clientMessage.toLowerCase().trim();
  const aiResponseLower = aiResponse.toLowerCase();

  // Verificar que el AI esté confirmando un método de pago
  const aiConfirmsPayment =
    (aiResponseLower.includes('pagarás en efectivo') ||
      aiResponseLower.includes('pagarás con tarjeta') ||
      aiResponseLower.includes("you'll pay with cash") ||
      aiResponseLower.includes("you'll pay with card") ||
      aiResponseLower.includes('vous paierez en espèces') ||
      aiResponseLower.includes('vous paierez par carte') ||
      aiResponseLower.includes('현금으로 결제하시겠습니다') ||
      aiResponseLower.includes('카드로 결제하시겠습니다')) &&
    (aiResponseLower.includes('en unos momentos se acercará') ||
      aiResponseLower.includes('someone from our staff will be with you') ||
      aiResponseLower.includes('quelqu\'un de notre personnel viendra') ||
      aiResponseLower.includes('곧 직원이 결제를 도와드리러'));

  if (!aiConfirmsPayment) {
    return { isPaymentMethod: false, paymentMethod: null };
  }

  // Detectar el método de pago del cliente
  const cashKeywords = [
    'efectivo',
    'cash',
    'espèces',
    '현금',
    'dinero',
    'billetes',
    '1',
  ];

  const cardKeywords = [
    'tarjeta',
    'card',
    'carte',
    '카드',
    'debito',
    'credito',
    'débito',
    'crédito',
    'debit',
    'credit',
    '2',
  ];

  const isCash = cashKeywords.some((keyword) =>
    clientLower.includes(keyword),
  );
  const isCard = cardKeywords.some((keyword) =>
    clientLower.includes(keyword),
  );

  if (isCash) {
    return { isPaymentMethod: true, paymentMethod: 'efectivo' };
  } else if (isCard) {
    return { isPaymentMethod: true, paymentMethod: 'tarjeta' };
  }

  // Si el AI confirmó pero no podemos detectar el método, asumir que hubo uno
  // (el AI lo interpretó correctamente)
  return { isPaymentMethod: true, paymentMethod: 'no especificado' };
};
