import { SaveMessage } from '../../interfaces/messages.interfaces';
import { ConversationMessage } from '../../entities/conversation-message.entity';

export const saveMessageUseCase = async (
  params: SaveMessage,
): Promise<ConversationMessage> => {
  const { conversationId, role, content, repository } = params;

  const message = repository.create({
    conversationId,
    role,
    content,
  });

  await repository.save(message);
  return message;
};
