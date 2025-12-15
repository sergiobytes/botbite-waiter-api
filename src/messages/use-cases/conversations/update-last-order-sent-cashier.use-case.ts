import { LastOrderSentToCashier } from '../../interfaces/conversations.interfaces';

export const updateLastOrderSentToCashierUseCase = async (
  params: LastOrderSentToCashier,
): Promise<void> => {
  const { conversationId, repository, orderData, logger } = params;

  // Usar optimistic locking para evitar sobrescribir cambios concurrentes
  // Aumentado a 7 reintentos para soportar 100+ usuarios simultáneos
  const maxRetries = 7;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      // Obtener conversación actual con su versión
      const conversation = await repository.findOne({
        where: { conversationId },
      });

      if (!conversation) {
        logger.error(`Conversation not found: ${conversationId}`);
        return;
      }

      // Actualizar datos
      conversation.lastOrderSentToCashier = orderData;
      conversation.lastActivity = new Date();

      // save() verifica automáticamente la versión y lanza error si cambió
      await repository.save(conversation);

      logger.log(
        `Updated last order sent to cashier for conversation: ${conversationId}`,
      );
      return;
    } catch (error) {
      // Si falla por versión, reintentar
      if (error.message?.includes('version') || error.name === 'OptimisticLockVersionMismatchError') {
        retries++;
        logger.warn(
          `Optimistic lock conflict on conversation ${conversationId}, retry ${retries}/${maxRetries}`,
        );
        // Exponential backoff: 50ms * 2^retries + jitter aleatorio
        const backoffMs = Math.min(50 * Math.pow(2, retries) + Math.random() * 100, 5000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
        throw error;
      }
    }
  }

  logger.error(
    `Failed to update conversation ${conversationId} after ${maxRetries} retries`,
  );
  throw new Error(`Optimistic lock failed after ${maxRetries} retries`);
};
