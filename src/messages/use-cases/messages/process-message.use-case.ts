import { ProcessMessage } from '../../interfaces/messages.interfaces';
import { getOrCreateConversationUseCase } from '../conversations/get-create-conversation.use-case';
import { getConversationHistoryUseCase } from './get-conversation-history.use-case';
import { saveMessageUseCase } from './save-message.use-case';

export const processMessageUseCase = async (
  params: ProcessMessage,
): Promise<string> => {
  const {
    phoneNumber,
    userMessage,
    branchId,
    customerContext,
    branchContext,
    logger,
    conversationRepository,
    conversationMessageRepository,
    service,
  } = params;

  try {
    const conversation = await getOrCreateConversationUseCase({
      phoneNumber,
      branchId,
      logger,
      repository: conversationRepository,
      service,
    });

    const { messages } = await getConversationHistoryUseCase({
      conversationId: conversation.id,
      repository: conversationMessageRepository,
    });

    await saveMessageUseCase({
      conversationId: conversation.id,
      role: 'user',
      content: userMessage,
      repository: conversationMessageRepository,
    });

    const aiResponse = await service.sendMessage(
      conversation.conversationId,
      userMessage,
      messages,
      customerContext,
      branchContext,
    );

    await saveMessageUseCase({
      conversationId: conversation.id,
      role: 'assistant',
      content: aiResponse,
      repository: conversationMessageRepository,
    });

    logger.log(
      `Message processed successfully for conversation: ${conversation.conversationId}`,
    );

    return aiResponse;
  } catch (error) {
    logger.log('Error processing message: ', error);
    throw error;
  }
};
