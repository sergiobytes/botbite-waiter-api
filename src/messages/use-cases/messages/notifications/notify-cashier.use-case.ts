import { NotifyCashier } from '../../../interfaces/messages.interfaces';
import { calculateOrderChangesUtil } from '../../../utils/calculate-order-changes.util';
import { extractOrderFromResponseUtil } from '../../../utils/extract-order-from-response.util';
import { extractTableInfoFromConversationUtil } from '../../../utils/extract-table-information-from-conversation.util';
import { generateCashierMessageUseCase } from '../generate-cashier-message.use-case';
import { sendMessageUseCase } from '../send-message.use-case';

export const notifyCashierAboutInappropriateBehaviorUseCase = async (
  params: NotifyCashier,
): Promise<void> => {
  const { from, message, customer, branch, twilioService, logger } = params;

  try {
    const notificationMessage = `🚨: Comportamiento inapropiado detectado de ${from}: "${message}"
    Cliente: ${customer.name}
    Se ha terminado la conversación con el cliente. Por favor, tome las medidas necesarias.
    `;

    await sendMessageUseCase({
      customerPhone: branch.phoneNumberReception,
      message: notificationMessage,
      assistantPhone: branch.phoneNumberAssistant,
      logger,
      twilioService,
    });

    logger.warn(`Inappropriate behavior detected from ${from}: "${message}"`);
  } catch (error) {
    logger.error(
      'Error notifying cashier about inappropriate behavior:',
      error,
    );
  }
};

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
      conversation.id,
    );

    let prdMessage: string | null = null;
    let assistantMessagesFound = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role === 'assistant') {
        assistantMessagesFound++;

        if (assistantMessagesFound === 1) continue;

        if (
          message.content.includes('• ') &&
          (message.content.includes('He agregado') ||
            message.content.includes('He actualizado') ||
            message.content.includes('Aquí tienes'))
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
      conversation.id,
      conversationService,
      logger,
    );

    const message = await generateCashierMessageUseCase({
      customerName: customer.name,
      menuId: branch.menus[0].id,
      orderChanges,
      tableInfo,
      service: menuService!,
    });

    await sendMessageUseCase({
      assistantPhone: branch.phoneNumberAssistant,
      customerPhone: branch.phoneNumberReception,
      message,
      logger,
      twilioService,
    });

    await conversationService.updateLastOrderSentToCashier(
      conversation.id,
      currentOrder,
    );

    logger.log('Cashier notified about confirmed products successfully');
  } catch (error) {
    logger.error('Error notifying cashier about confirmed products:', error);
  }
};
