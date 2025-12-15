import { Repository, LessThan } from 'typeorm';
import { Conversation } from '../../entities/conversation.entity';
import { Logger } from '@nestjs/common';

export const cleanupOldConversationsUseCase = async (
  repository: Repository<Conversation>,
  logger: Logger,
): Promise<number> => {
  // Calcular fecha límite: 24 horas atrás
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  try {
    // Buscar conversaciones inactivas por más de 24 horas
    const oldConversations = await repository.find({
      where: {
        lastActivity: LessThan(twentyFourHoursAgo),
      },
    });

    if (oldConversations.length === 0) {
      logger.log('No old conversations to clean up');
      return 0;
    }

    // Borrar conversaciones encontradas
    await repository.remove(oldConversations);

    logger.log(
      `Successfully cleaned up ${oldConversations.length} conversations older than 24 hours`,
    );

    return oldConversations.length;
  } catch (error) {
    logger.error('Error cleaning up old conversations', error);
    throw error;
  }
};
