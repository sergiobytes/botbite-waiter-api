import { NotifyCashier } from '../../../interfaces/messages.interfaces';
import { calculateOrderChangesUtil } from '../../../utils/calculate-order-changes.util';
import { extractOrderFromResponseUtil } from '../../../utils/extract-order-from-response.util';
import { extractTableInfoFromConversationUtil } from '../../../utils/extract-table-information-from-conversation.util';
import { generateCashierMessageUseCase } from '../generate-cashier-message.use-case';
import { sendMessageUseCase } from '../send-message.use-case';

export const notifyCashierAboutConfirmedProductsUseCase = async (
  params: NotifyCashier,
): Promise<void> => {
  const {
    from,
    customer,
    branch,
    twilioService,
    conversationService,
    menuService,
    logger,
  } = params;

  try {
    const conversation = await conversationService.getOrCreateConversation(
      from,
      branch.id,
    );

    const { messages } = await conversationService.getConversationHistory(
      conversation.conversationId,
    );

    // Encontrar el índice de la última confirmación previa (si existe)
    // NO incluir la confirmación más reciente (que es la que activó esta notificación)
    let lastConfirmationIndex = -1;
    let confirmationCount = 0;
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      if (message.role === 'assistant') {
        const contentLower = message.content.toLowerCase();
        
        const isConfirmation = 
          contentLower.includes('perfecto, gracias por confirmar, tu pedido está ahora en proceso') ||
          contentLower.includes('perfect, thank you for confirming, your order is now being processed') ||
          contentLower.includes('parfait, merci de confirmer, votre commande est maintenant en cours de traitement') ||
          contentLower.includes('완벽합니다. 확인해 주셔서 감사합니다. 주문이 이제 처리 중입니다');
        
        if (isConfirmation) {
          confirmationCount++;
          // Solo guardar si NO es la última confirmación
          if (i < messages.length - 1) {
            lastConfirmationIndex = i;
            logger.log(`Found previous confirmation at index ${i}`);
          } else {
            logger.log(`Found current confirmation at index ${i} (skipping)`);
          }
        }
      }
    }

    logger.log(`Last PREVIOUS confirmation index: ${lastConfirmationIndex}, total messages: ${messages.length}, total confirmations: ${confirmationCount}`);

    // Buscar el mensaje de productos inmediatamente ANTERIOR a la confirmación actual
    // La confirmación actual está en el último mensaje (messages.length - 1)
    let productMessage: string | null = null;
    
    // Buscar hacia atrás desde el penúltimo mensaje hasta encontrar el mensaje con productos
    for (let i = messages.length - 2; i >= 0; i--) {
      const message = messages[i];
      if (message.role === 'assistant') {
        const contentLower = message.content.toLowerCase();
        
        const isRecommendation = 
          contentLower.includes('puedo sugerir') ||
          contentLower.includes('i recommend') ||
          contentLower.includes('je recommande') ||
          contentLower.includes('추천합니다') ||
          contentLower.includes('te recomiendo') ||
          contentLower.includes('with pleasure') ||
          contentLower.includes('avec plaisir') ||
          contentLower.includes('기꺼이') ||
          contentLower.includes('⭐ recomendado') ||
          contentLower.includes('¡con gusto!');
        
        // No incluir mensajes de confirmación previas
        const isConfirmation = 
          contentLower.includes('perfecto, gracias por confirmar') ||
          contentLower.includes('perfect, thank you for confirming') ||
          contentLower.includes('parfait, merci de confirmer') ||
          contentLower.includes('완벽합니다. 확인해 주셔서 감사합니다');

        const hasProducts = message.content.includes('• ') && message.content.match(/\[ID:[^\]]+\]/);
        const hasAddedKeyword = 
          contentLower.includes('he agregado') ||
          contentLower.includes('he actualizado') ||
          contentLower.includes('aquí tienes') ||
          contentLower.includes('i added') ||
          contentLower.includes('i updated') ||
          contentLower.includes('here is') ||
          contentLower.includes('j\'ai ajouté') ||
          contentLower.includes('j\'ai mis à jour') ||
          contentLower.includes('추가했습니다') ||
          contentLower.includes('업데이트했습니다');

        logger.log(`Checking message ${i}: isRecommendation=${isRecommendation}, isConfirmation=${isConfirmation}, hasProducts=${hasProducts}, hasAddedKeyword=${hasAddedKeyword}`);

        if (
          !isRecommendation &&
          !isConfirmation &&
          hasProducts &&
          hasAddedKeyword
        ) {
          productMessage = message.content;
          logger.log(`Found product message at index ${i}`);
          break; // Encontramos el mensaje, salimos del loop
        }
      }
    }

    logger.log(`Product message found: ${productMessage !== null}`);

    logger.log(`Product message found: ${productMessage !== null}`);

    if (!productMessage) {
      logger.warn('Could not find product message immediately before confirmation');
      return;
    }

    const currentOrder = extractOrderFromResponseUtil(productMessage);

    const lastSentOrder = conversation.lastOrderSentToCashier || {};

    const orderChanges = calculateOrderChangesUtil(lastSentOrder, currentOrder);

    if (Object.keys(orderChanges).length === 0) {
      logger.log('No changes to notify cashier about');
      return;
    }

    const tableInfo = await extractTableInfoFromConversationUtil(
      conversation.conversationId,
      conversationService,
      logger,
    );

    const message = await generateCashierMessageUseCase({
      customerName: customer.name,
      menuId: branch.menus[0].id,
      orderChanges,
      tableInfo,
      service: menuService,
    });

    await sendMessageUseCase({
      assistantPhone: branch.phoneNumberAssistant,
      customerPhone: branch.phoneNumberReception!,
      message,
      logger,
      twilioService,
    });

    // IMPORTANTE: currentOrder ya contiene las cantidades ACUMULADAS totales
    // porque el asistente muestra todo el pedido acumulado.
    // Por lo tanto, simplemente guardamos currentOrder como el nuevo lastOrderSentToCashier
    // (no necesitamos sumar nada, currentOrder ES el estado completo actual)
    
    logger.log(`Updating lastOrderSentToCashier with current order: ${JSON.stringify(currentOrder)}`);

    await conversationService.updateLastOrderSentToCashier(
      conversation.conversationId,
      currentOrder,
    );

    logger.log('Cashier notified about confirmed products successfully');
  } catch (error) {
    logger.error('Error notifying cashier about confirmed products:', error);
  }
};
