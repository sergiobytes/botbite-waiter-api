import { Conversation } from '../../entities/conversation.entity';
import { GetCreateConversation } from '../../interfaces/conversations.interfaces';

export const getOrCreateConversationUseCase = async (
  params: GetCreateConversation,
): Promise<Conversation> => {
  const { phoneNumber, branchId, repository, service, logger } = params;

  // Usar transacción para evitar race conditions
  const queryRunner = repository.manager.connection.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction('READ COMMITTED');

  try {
    // Intentar obtener la conversación con lock FOR UPDATE
    let conversation = (await queryRunner.manager
      .createQueryBuilder()
      .select('conversation')
      .from('conversations', 'conversation')
      .where('conversation.phoneNumber = :phoneNumber', { phoneNumber })
      .setLock('pessimistic_write') // Lock para evitar duplicados
      .getOne()) as Conversation | null;

    if (conversation) {
      // Actualizar lastActivity
      conversation.lastActivity = new Date();
      await queryRunner.manager.save(conversation);
    } else {
      // Crear nueva conversación
      const id = service.createConversation();

      conversation = repository.create({
        conversationId: id,
        phoneNumber,
        branchId,
        lastActivity: new Date(),
      });

      await queryRunner.manager.save(conversation);
      logger.log(`New conversation created for phone: ${phoneNumber}`);
    }

    await queryRunner.commitTransaction();

    // Return the conversation from the transaction context
    // No need to reload with messages since they're not used immediately
    if (!conversation) {
      throw new Error(
        `Conversation object is null after transaction for phone ${phoneNumber}`,
      );
    }

    logger.log(
      `Returning conversation ${conversation.conversationId} for phone ${phoneNumber}`,
    );

    return conversation;
  } catch (error) {
    await queryRunner.rollbackTransaction();
    logger.error(`Error in getOrCreateConversation: ${error.message}`);
    throw error;
  } finally {
    await queryRunner.release();
  }
};
