/**
 * Enum de intenciones del cliente para seleccionar el prompt apropiado
 */
export enum CustomerIntention {
  LANGUAGE_SELECTION = 'language_selection', // Cliente seleccionando idioma inicial
  LOCATION_NEEDED = 'location_needed', // Cliente necesita proporcionar ubicación
  VIEW_MENU = 'view_menu', // Cliente quiere ver menú completo
  VIEW_CATEGORY = 'view_category', // Cliente pregunta por categoría específica
  PLACE_ORDER = 'place_order', // Cliente está pidiendo productos
  CONFIRM_ORDER = 'confirm_order', // Cliente confirma pedido
  REQUEST_RECOMMENDATIONS = 'request_recommendations', // Cliente pide recomendaciones
  BUDGET_INQUIRY = 'budget_inquiry', // Cliente pregunta por presupuesto
  TOTAL_QUERY = 'total_query', // Cliente pregunta cuánto lleva
  REQUEST_BILL = 'request_bill', // Cliente pide la cuenta
  PAYMENT_METHOD = 'payment_method', // Cliente selecciona método de pago
  REQUEST_AMENITIES = 'request_amenities', // Cliente pide amenidades
  GENERAL = 'general', // Conversación general o no clasificada
}

/**
 * Detecta la intención del cliente basado en su mensaje y el historial
 */
export const detectCustomerIntention = (
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
): CustomerIntention => {
  const lowerMessage = message.toLowerCase().trim();

  // 1. Detección de selección de idioma (primer mensaje o respuesta a pregunta de idioma)
  const languageKeywords = [
    '🇲🇽',
    '🇺🇸',
    '🇫🇷',
    '🇰🇷',
    'español',
    'english',
    'français',
    'korean',
    '한국어',
  ];
  const lastBotMessage =
    conversationHistory.length > 0
      ? conversationHistory[conversationHistory.length - 1]
      : null;
  const isLanguageQuestion =
    lastBotMessage &&
    lastBotMessage.role === 'assistant' &&
    (lastBotMessage.content.includes('idioma') ||
      lastBotMessage.content.includes('language'));

  if (
    isLanguageQuestion ||
    languageKeywords.some((keyword) => lowerMessage.includes(keyword))
  ) {
    return CustomerIntention.LANGUAGE_SELECTION;
  }

  // 2. Verificar si necesita ubicación (no hay ubicación en historial)
  const hasLocation = conversationHistory.some((msg) =>
    /mesa|table|terraza|terrace|barra|bar|patio|^[a-z]\d+$/i.test(msg.content),
  );

  if (!hasLocation && conversationHistory.length > 2) {
    // Si ya pasó selección de idioma y no tiene ubicación
    return CustomerIntention.LOCATION_NEEDED;
  }

  // 2b. Si el mensaje ACTUAL contiene ubicación Y el último mensaje del bot preguntó por ubicación
  // entonces acaba de dar su ubicación → debe mostrar menú inmediatamente
  const messageContainsLocation =
    /mesa|table|terraza|terrace|barra|bar|patio|\d+|^[a-z]\d+$/i.test(
      lowerMessage,
    );
  const botAskedForLocation =
    lastBotMessage &&
    (lastBotMessage.content.includes('número de mesa') ||
      lastBotMessage.content.includes('table number') ||
      lastBotMessage.content.includes('ubicación') ||
      lastBotMessage.content.includes('location') ||
      lastBotMessage.content.includes('parte te encuentras') ||
      lastBotMessage.content.includes("where you're located"));

  if (messageContainsLocation && botAskedForLocation) {
    // Acaba de dar ubicación, debe mostrar menú
    return CustomerIntention.VIEW_MENU;
  }

  // 3. Método de pago (responde después de pedir cuenta)
  const paymentKeywords = [
    'efectivo',
    'cash',
    'tarjeta',
    'card',
    'carte',
    'espèces',
    '현금',
    '카드',
  ];
  const lastMessageWasBill =
    lastBotMessage &&
    (lastBotMessage.content.includes('cuenta') ||
      lastBotMessage.content.includes('bill') ||
      lastBotMessage.content.includes('addition') ||
      lastBotMessage.content.includes('계산서'));

  if (
    lastMessageWasBill &&
    paymentKeywords.some((keyword) => lowerMessage.includes(keyword))
  ) {
    return CustomerIntention.PAYMENT_METHOD;
  }

  // 4. Solicitud de cuenta
  const billKeywords = [
    'la cuenta',
    'cuenta por favor',
    'quiero pagar',
    'the check',
    'the bill',
    'bill please',
    "l'addition",
    'je veux payer',
    '계산서',
    '계산할게요',
    '계산서 주세요',
  ];
  if (billKeywords.some((keyword) => lowerMessage.includes(keyword))) {
    return CustomerIntention.REQUEST_BILL;
  }

  // 5. Consulta de total (sin pedir cuenta)
  const totalKeywords = [
    'cuánto llevo',
    'cuánto va',
    'cuánto lleva',
    'how much',
    'my total',
    'combien',
    'quel est mon total',
    '얼마예요',
    '총액',
  ];
  if (totalKeywords.some((keyword) => lowerMessage.includes(keyword))) {
    return CustomerIntention.TOTAL_QUERY;
  }

  // 6. Amenidades
  const amenitiesKeywords = [
    'tenedor',
    'cuchillo',
    'cuchara',
    'cubiert',
    'servilleta',
    'vaso',
    'plato',
    'popote',
    'sal',
    'pimienta',
    'limón',
    'salsa',
    'chile',
    'fork',
    'knife',
    'spoon',
    'napkin',
    'glass',
    'plate',
    'straw',
    'salt',
    'pepper',
    'lemon',
    'sauce',
  ];
  if (amenitiesKeywords.some((keyword) => lowerMessage.includes(keyword))) {
    return CustomerIntention.REQUEST_AMENITIES;
  }

  // 7. Presupuesto
  const budgetKeywords = [
    'qué me alcanza',
    'tengo',
    'presupuesto',
    'what can i get for',
    'i have',
    'budget',
    "qu'est-ce que je peux avoir",
    "j'ai",
  ];
  if (budgetKeywords.some((keyword) => lowerMessage.includes(keyword))) {
    if (/\d+/.test(lowerMessage)) {
      // Contiene número
      return CustomerIntention.BUDGET_INQUIRY;
    }
  }

  // 8. Recomendaciones
  const recommendationKeywords = [
    'recomienda',
    'recomendación',
    'sugerencia',
    'qué está bueno',
    'recommend',
    'suggestion',
    'what do you suggest',
    'recommande',
    '추천',
  ];
  if (
    recommendationKeywords.some((keyword) => lowerMessage.includes(keyword))
  ) {
    return CustomerIntention.REQUEST_RECOMMENDATIONS;
  }

  // 9. Ver menú completo
  const menuKeywords = [
    'menú completo',
    'la carta',
    'qué venden',
    'puedo ver el menú',
    'full menu',
    'menu',
    'what do you have',
    'menu complet',
    '메뉴',
  ];
  if (menuKeywords.some((keyword) => lowerMessage.includes(keyword))) {
    return CustomerIntention.VIEW_MENU;
  }

  // 10. Ver categoría específica
  const categoryKeywords = [
    'qué.*tienen',
    'cuáles.*tienen',
    'what.*do you have',
    'quelles.*avez-vous',
    '어떤.*있나요',
  ];
  const categoryRegex = new RegExp(categoryKeywords.join('|'), 'i');
  if (categoryRegex.test(lowerMessage)) {
    return CustomerIntention.VIEW_CATEGORY;
  }

  // 11. Confirmación de pedido (responde "no" a agregar más O "sí" a confirmar pedido)
  const confirmationKeywords = [
    'no',
    'nada más',
    'nada mas',
    'está bien',
    'esta bien',
    'así está bien',
    'asi esta bien',
    "that's all",
    "that's it",
    'no more',
    'nothing else',
    "c'est tout",
    '없어요',
    '됐어요',
  ];

  const affirmativeKeywords = [
    'sí',
    'si',
    'yes',
    'oui',
    '네',
    'confirmar',
    'confirm',
    'confirme',
  ];

  const lastMessageWasAddMore =
    lastBotMessage &&
    (lastBotMessage.content.includes('agregar algo más') ||
      lastBotMessage.content.includes('add something else') ||
      lastBotMessage.content.includes('ajouter autre chose'));

  const lastMessageAskedToAddProduct =
    lastBotMessage &&
    (lastBotMessage.content.includes('agregar') ||
      lastBotMessage.content.includes('add') ||
      lastBotMessage.content.includes('ajouter')) &&
    (lastBotMessage.content.includes('a tu pedido') ||
      lastBotMessage.content.includes('to your order') ||
      lastBotMessage.content.includes('à votre commande'));

  const lastMessageAskedToConfirm =
    lastBotMessage &&
    (lastBotMessage.content.includes('confirmar este pedido') ||
      lastBotMessage.content.includes('te gustaría confirmar') ||
      lastBotMessage.content.includes('deseas confirmar') ||
      lastBotMessage.content.includes('confirm this order') ||
      lastBotMessage.content.includes('would you like to confirm') ||
      lastBotMessage.content.includes('confirmer cette commande') ||
      lastBotMessage.content.includes('souhaitez-vous confirmer'));

  // Check if message contains order-related keywords that indicate it's actually an order, not confirmation
  const orderRelatedKeywords = [
    'agregar',
    'agrega',
    'agrégame',
    'dame',
    'quiero',
    'queremos',
    'añade',
    'add',
    'give me',
    'i want',
    'we want',
    'ajoute',
    'je veux',
  ];
  const hasOrderContext = orderRelatedKeywords.some((keyword) =>
    lowerMessage.includes(keyword),
  );

  // SPECIAL CASE: If bot asked to add a specific product and user says yes, it's an order
  if (
    lastMessageAskedToAddProduct &&
    affirmativeKeywords.some((keyword) => lowerMessage.includes(keyword))
  ) {
    return CustomerIntention.PLACE_ORDER;
  }

  // Only treat as confirmation if:
  // 1. Bot asked "add more?" AND user said "no" AND no order keywords present
  // 2. Bot asked "confirm order?" AND user said "yes"
  if (
    (lastMessageWasAddMore &&
      confirmationKeywords.some((keyword) => lowerMessage.includes(keyword)) &&
      !hasOrderContext) || // CRITICAL: Don't confirm if order keywords present
    (lastMessageAskedToConfirm &&
      affirmativeKeywords.some((keyword) => lowerMessage.includes(keyword)))
  ) {
    return CustomerIntention.CONFIRM_ORDER;
  }

  // 12. Hacer pedido (menciona productos o números)
  // Si el mensaje tiene contexto de productos o cantidades, probablemente es un pedido
  const hasProductContext =
    /\d+/.test(lowerMessage) || // Tiene números (cantidades)
    lowerMessage.split(' ').length <= 5; // Mensaje corto (típico de pedidos)

  if (hasProductContext && hasLocation) {
    return CustomerIntention.PLACE_ORDER;
  }

  // 13. Default: General
  return CustomerIntention.GENERAL;
};
