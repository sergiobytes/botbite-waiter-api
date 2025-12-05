import { Conversation } from '../../entities/conversation.entity';
import { GetCreateConversation } from '../../interfaces/conversations.interfaces';

export const getOrCreateConversationUseCase = async (
  params: GetCreateConversation,
): Promise<Conversation> => {
  const { phoneNumber, branchId, repository, service, logger } = params;

  let conversation = await repository.findOne({
    where: { phoneNumber },
    relations: { messages: true },
    order: { lastActivity: 'DESC' },
  });

  if (conversation) {
    conversation.lastActivity = new Date();
  } else {
    const id = service.createConversation();

    conversation = repository.create({
      conversationId: id,
      phoneNumber,
      branchId,
      lastActivity: new Date(),
    });

    logger.log(`New conversation created for phone: ${phoneNumber}`);
  }

  await repository.save(conversation);

  return conversation;
};
