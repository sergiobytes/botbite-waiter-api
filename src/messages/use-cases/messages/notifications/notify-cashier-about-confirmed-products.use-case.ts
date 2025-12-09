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
    let assistantMessagesFound = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role === 'assistant') {
        assistantMessagesFound++;

        if (assistantMessagesFound === 1) continue;

        const isRecommendation = 
          message.content.includes('puedo sugerir') ||
          message.content.includes('I recommend') ||
          message.content.includes('je recommande') ||
          message.content.includes('추천합니다') ||
          message.content.includes('Te recomiendo') ||
          message.content.includes('With pleasure') ||
          message.content.includes('Avec plaisir') ||
          message.content.includes('기꺼이') ||
          message.content.includes('⭐ RECOMENDADO');

        // Solo considerar como pedido si NO es recomendación y tiene el formato correcto
        if (
          !isRecommendation &&
          message.content.includes('• ') &&
          (message.content.includes('He agregado') ||
            message.content.includes('He actualizado') ||
            message.content.includes('Aquí tienes') ||
            message.content.includes('I added') ||
            message.content.includes('I updated') ||
            message.content.includes('Here is') ||
            message.content.includes('J\'ai ajouté') ||
            message.content.includes('J\'ai mis à jour') ||
            message.content.includes('추가했습니다') ||
            message.content.includes('업데이트했습니다')) &&
          message.content.match(/\[ID:[^\]]+\]/)
        ) {
          prdMessage = message.content;
          break;
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
