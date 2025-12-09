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

    let prdMessage: string | null = null;

    // Buscar el último mensaje del asistente con productos (antes del mensaje de confirmación)
    let confirmationFound = false;
    
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role === 'assistant') {
        const contentLower = message.content.toLowerCase();
        
        // Detectar mensaje de confirmación (case-insensitive)
        const isConfirmation = 
          contentLower.includes('perfecto, gracias por confirmar, tu pedido está ahora en proceso') ||
          contentLower.includes('perfect, thank you for confirming, your order is now being processed') ||
          contentLower.includes('parfait, merci de confirmer, votre commande est maintenant en cours de traitement') ||
          contentLower.includes('완벽합니다. 확인해 주셔서 감사합니다. 주문이 이제 처리 중입니다');
        
        // Si encontramos confirmación, saltarla y buscar el mensaje con productos anterior
        if (isConfirmation) {
          confirmationFound = true;
          continue;
        }
        
        // Si ya encontramos confirmación, buscar el mensaje con productos inmediatamente anterior
        if (confirmationFound) {
          const isRecommendation = 
            contentLower.includes('puedo sugerir') ||
            contentLower.includes('i recommend') ||
            contentLower.includes('je recommande') ||
            contentLower.includes('추천합니다') ||
            contentLower.includes('te recomiendo') ||
            contentLower.includes('with pleasure') ||
            contentLower.includes('avec plaisir') ||
            contentLower.includes('기꺼이') ||
            contentLower.includes('⭐ recomendado');

          if (
            !isRecommendation &&
            message.content.includes('• ') &&
            (contentLower.includes('he agregado') ||
              contentLower.includes('he actualizado') ||
              contentLower.includes('aquí tienes') ||
              contentLower.includes('i added') ||
              contentLower.includes('i updated') ||
              contentLower.includes('here is') ||
              contentLower.includes('j\'ai ajouté') ||
              contentLower.includes('j\'ai mis à jour') ||
              contentLower.includes('추가했습니다') ||
              contentLower.includes('업데이트했습니다')) &&
            message.content.match(/\[ID:[^\]]+\]/)
          ) {
            prdMessage = message.content;
            break;
          }
        }
      }
    }

    if (!prdMessage) {
      logger.warn('Could not find product message in conversation history');
      return;
    }

    const currentOrder = extractOrderFromResponseUtil(prdMessage);

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

    await conversationService.updateLastOrderSentToCashier(
      conversation.conversationId,
      currentOrder,
    );

    logger.log('Cashier notified about confirmed products successfully');
  } catch (error) {
    logger.error('Error notifying cashier about confirmed products:', error);
  }
};
