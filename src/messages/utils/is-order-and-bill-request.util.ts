/**
 * Detecta si el cliente está pidiendo productos Y solicitando la cuenta en el mismo mensaje
 */
export const isOrderAndBillRequestUtil = (
  clientMessage: string,
  aiResponse: string,
): {
  isOrderAndBill: boolean;
  hasProducts: boolean;
  hasBillRequest: boolean;
} => {
  const clientLower = clientMessage.toLowerCase().trim();
  const aiResponseLower = aiResponse.toLowerCase();

  // Detectar palabras clave de solicitud de cuenta
  const billKeywords = [
    'la cuenta',
    'cuenta por favor',
    'quiero pagar',
    'pagar',
    'cuenta',
    'the check',
    'the bill',
    'bill please',
    'check please',
    "l'addition",
    'je veux payer',
    '계산서',
    '계산할게요',
  ];

  // Excluir casos donde NO es solicitud de cuenta
  const separateAccountsKeywords = [
    'cuentas separadas',
    'separate accounts',
    'comptes séparés',
    'separate bills',
    'split bill',
    'dividir la cuenta',
  ];

  const isSeparateAccountsRequest = separateAccountsKeywords.some((keyword) =>
    clientLower.includes(keyword),
  );

  const hasBillRequest =
    !isSeparateAccountsRequest &&
    billKeywords.some((keyword) => clientLower.includes(keyword));

  // Detectar si el AI agregó productos (formato con ID)
  const hasProducts =
    aiResponseLower.includes('he agregado') ||
    aiResponseLower.includes('i added') ||
    aiResponseLower.includes("j'ai ajouté") ||
    /\[ID:[^\]]+\]/.test(aiResponse);

  // Es orden y cuenta si:
  // 1. El mensaje del cliente menciona cuenta
  // 2. El AI respuesta agregó productos
  const isOrderAndBill = hasBillRequest && hasProducts;

  return {
    isOrderAndBill,
    hasProducts,
    hasBillRequest,
  };
};
