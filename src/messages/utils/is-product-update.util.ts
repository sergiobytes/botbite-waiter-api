export const isProductUpdateUtil = (
  clientMessage: string,
  aiResponse: string,
): boolean => {
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
    // Nota: 'más'/'mas' removido porque causa false positive con "nada más"
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

  // Palabras que indican que el cliente está MODIFICANDO el pedido (notas, cambios)
  const isModifyingOrder = 
    clientLower.includes('sin ') ||
    clientLower.includes('con ') ||
    clientLower.includes('without') ||
    clientLower.includes('with ') ||
    clientLower.includes('sans ') ||
    clientLower.includes('avec ') ||
    clientLower.includes('cambio') ||
    clientLower.includes('cambia') ||
    clientLower.includes('modifica') ||
    clientLower.includes('change') ||
    clientLower.includes('modify');

  if (isModifyingOrder) {
    return false;
  }

  // Palabras que indican que el cliente YA NO quiere agregar más (confirmación final)
  const clientFinalizesOrder = [
    'no',
    'nada',
    'nada más',
    'es todo',
    'eso es todo',
    'así está bien',
    'asi esta bien',
    'está bien',
    'esta bien',
    'ya',
    'ya es todo',
    'suficiente',
    'nothing',
    'nothing else',
    'that\'s all',
    'that\'s it',
    'no more',
    'i\'m good',
    'we\'re good',
    'rien',
    'c\'est tout',
    'ça suffit',
    '됐습니다',
    '그만',
    '충분합니다',
  ];

  const clientSaysNoMore = clientFinalizesOrder.some((keyword) =>
    clientLower.includes(keyword),
  );

  // El AI debe haber preguntado si desea agregar algo más O haber agregado productos
  const aiAskForMore =
    aiResponseLower.includes('deseas agregar algo más') ||
    aiResponseLower.includes('would you like to add something else') ||
    aiResponseLower.includes('souhaitez-vous ajouter autre chose') ||
    aiResponseLower.includes('다른 것을 추가하시겠습니까') ||
    aiResponseLower.includes('te gustaría agregar algo más') ||
    aiResponseLower.includes('hay algo más que te gustaría ordenar') ||
    aiResponseLower.includes('algo más que pueda ayudarte');

  const aiHasProducts = 
    aiResponseLower.includes('he agregado') ||
    aiResponseLower.includes('he actualizado') ||
    aiResponseLower.includes('i added') ||
    aiResponseLower.includes('i updated') ||
    aiResponseLower.includes('j\'ai ajouté') ||
    aiResponseLower.includes('j\'ai mis à jour');

  // O el AI confirmó explícitamente el pedido
  const aiConfirmsOrder =
    aiResponseLower.includes('perfecto, gracias por confirmar') ||
    aiResponseLower.includes('gracias por confirmar');

  // La confirmación inicial tiene características específicas:
  // - Dice "tu pedido está ahora en proceso"
  // - NO tiene "he agregado/actualizado" (porque no hubo productos previos)
  // - NO pregunta "¿deseas agregar algo más?" (porque ya terminó)
  const isInitialConfirmation = 
    aiResponseLower.includes('tu pedido está ahora en proceso') &&
    !aiHasProducts &&
    !aiAskForMore;

  // Solo es actualización de pedido si:
  // - Cliente dice que NO quiere más (no/nada/es todo)
  // - Y el AI preguntó si quiere agregar más O tiene productos O confirmó
  // - Y NO es la confirmación inicial
  return (
    clientSaysNoMore &&
    (aiAskForMore || aiHasProducts || aiConfirmsOrder) &&
    !isInitialConfirmation
  );
};
