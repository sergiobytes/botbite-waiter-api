import { DeleteConversation } from '../../interfaces/conversations.interfaces';

export const deleteConversationUseCase = async (
  params: DeleteConversation,
): Promise<void> => {
  const {
    conversationId,
    conversationRepository,
    conversationMessageRepository,
    logger,
  } = params;

  try {
    await conversationMessageRepository.delete({ conversationId });
    await conversationRepository.delete({ conversationId });

    logger.log(`Conversation and all its messages deleted: ${conversationId}`);
  } catch (error) {
    logger.error(`Error deleting conversation ${conversationId}:`, error);
    throw error;
  }
};
