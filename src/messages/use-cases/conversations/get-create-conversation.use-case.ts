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
    let conversation = await queryRunner.manager
      .createQueryBuilder()
      .select('conversation')
      .from('conversations', 'conversation')
      .where('conversation.phoneNumber = :phoneNumber', { phoneNumber })
      .setLock('pessimistic_write') // Lock para evitar duplicados
      .getOne() as Conversation | null;

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

    // Cargar relaciones después del commit
    const fullConversation = await repository.findOne({
      where: { phoneNumber },
      relations: { messages: true },
    });

    return fullConversation!;
  } catch (error) {
    await queryRunner.rollbackTransaction();
    logger.error(`Error in getOrCreateConversation: ${error.message}`);
    throw error;
  } finally {
    await queryRunner.release();
  }
};
