import { FindManyOptions } from 'typeorm';
import { ConversationMessage } from '../../entities/conversation-message.entity';
import {
    ConversationHistoryResponse,
    GetConversationHistory,
} from '../../interfaces/messages.interfaces';

export const getConversationHistoryUseCase = async (
  params: GetConversationHistory,
): Promise<ConversationHistoryResponse> => {
  const { conversationId, repository } = params;

  const findOptions: FindManyOptions<ConversationMessage> = {
    where: { conversationId },
    order: { createdAt: 'ASC' },
  };

  const messages = await repository.find(findOptions);

  return {
    messages: messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
  };
};
