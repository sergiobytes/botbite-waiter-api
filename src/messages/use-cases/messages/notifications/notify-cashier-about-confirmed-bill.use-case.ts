import { NotifyCashier } from '../../../interfaces/messages.interfaces';
import { extractTableInfoFromConversationUtil } from '../../../utils/extract-table-information-from-conversation.util';
import { createOrderAfterBillRequestUseCase } from '../create-order-after-bill-request.use-case';
import { sendMessageUseCase } from '../send-message.use-case';

export const notifyCashierAboutConfirmedBillUseCase = async (
  params: NotifyCashier,
): Promise<void> => {
  const {
    from,
    customer,
    branch,
    twilioService,
    conversationService,
    branchesService,
    ordersService,
    logger,
    paymentMethod = 'no especificado', // Valor por defecto si no se proporciona
  } = params;

  try {
    const conversation = await conversationService.getOrCreateConversation(
      from,
      branch.id,
    );

    const orderFromField = conversation.lastOrderSentToCashier;

    if (!orderFromField || Object.keys(orderFromField).length === 0) {
      logger.warn('No order found in lastOrderSentToCashier field');
      return;
    }

    logger.log(
      `Using order from lastOrderSentToCashier: ${JSON.stringify(orderFromField)}`,
    );

    // Usar la ubicación guardada en la conversación, o extraerla si no existe
    let tableInfo = conversation.location;
    if (!tableInfo) {
      tableInfo = await extractTableInfoFromConversationUtil(
        conversation.conversationId,
        conversationService,
        logger,
      );
      // Guardar la ubicación en la conversación si se acaba de extraer
      await conversationService.updateConversationLocation(
        conversation.conversationId,
        tableInfo,
      );
    }

    let totalAmount = 0;
    for (const [, { price, quantity }] of Object.entries(orderFromField)) {
      totalAmount += price * quantity;
    }

    const cashierMessage = `El cliente ${customer.name} en ${tableInfo}, ha solicitado su cuenta y está listo para pagar.

Total: $${totalAmount.toFixed(2)}
Método de pago: ${paymentMethod}`;

    await sendMessageUseCase({
      assistantPhone: branch.phoneNumberAssistant,
      customerPhone: branch.phoneNumberReception!,
      message: cashierMessage,
      logger,
      twilioService,
    });

    await branchesService.updateAvailableMessages(branch);

    const { messages } = await conversationService.getConversationHistory(
      conversation.conversationId,
    );

    const assistantInteractions = messages.filter(
      (msg) => msg.role === 'assistant',
    ).length;

    logger.log(
      `Assistant interactions in conversation: ${assistantInteractions}`,
    );

    const order = await createOrderAfterBillRequestUseCase({
      orderItems: orderFromField,
      customerId: customer.id,
      branch,
      service: ordersService,
      logger,
    });

    if (order) {
      await ordersService.updateOrder(
        order.id,
        { interactions: assistantInteractions },
        'es',
      );
      logger.log(
        `Order ${order.id} updated with ${assistantInteractions} interactions`,
      );
    }

    await conversationService.deleteConversation(conversation.conversationId);

    logger.log(
      `Bill confirmation notification sent and order created for customer ${customer.name}`,
    );
  } catch (error) {
    logger.error('Error notifying cashier about confirmed bill:', error);
  }
};
