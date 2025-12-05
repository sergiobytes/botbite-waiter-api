import { LastOrderSentToCashier } from '../../interfaces/conversations.interfaces';

export const updateLastOrderSentToCashierUseCase = async (
  params: LastOrderSentToCashier,
): Promise<void> => {
  const { conversationId, repository, orderData, logger } = params;

  await repository.update(
    { conversationId },
    { lastOrderSentToCashier: orderData },
  );

  logger.log(
    `Updated last order sent to cashier for conversation: ${conversationId}`,
  );
};
