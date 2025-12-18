import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Conversation } from '../../entities/conversation.entity';

export interface UpdateConversationLocation {
  conversationId: string;
  location: string;
  repository: Repository<Conversation>;
  logger: Logger;
}

export const updateConversationLocationUseCase = async (
  params: UpdateConversationLocation,
): Promise<void> => {
  const { conversationId, location, repository, logger } = params;

  try {
    const conversation = await repository.findOne({
      where: { conversationId },
    });

    if (!conversation) {
      logger.error(`Conversation not found: ${conversationId}`);
      return;
    }

    // Solo actualizar si no hay ubicación previa o si cambió
    if (conversation.location !== location) {
      conversation.location = location;
      conversation.lastActivity = new Date();
      await repository.save(conversation);

      logger.log(
        `Updated location for conversation ${conversationId}: ${location}`,
      );
    }
  } catch (error) {
    logger.error(
      `Error updating conversation location for ${conversationId}:`,
      error,
    );
  }
};
