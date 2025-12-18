import {
  ConversationsListResponse,
  FindConversationsByBranch,
} from '../../interfaces/conversations.interfaces';
import { IsNull, Not } from 'typeorm';

export const findConversationsByBranchUseCase = async (
  params: FindConversationsByBranch,
): Promise<ConversationsListResponse> => {
  const { branchId, repository, logger } = params;

  const conversations = await repository.find({
    where: {
      branchId,
      lastOrderSentAt: Not(IsNull()),
    },
    order: {
      lastOrderSentAt: 'DESC',
    },
    relations: {
      branch: true,
    },
    select: {
      id: true,
      conversationId: true,
      branchId: true,
      location: true,
      lastOrderSentAt: true,
      lastOrderSentToCashier: true,
      createdAt: true,
      branch: {
        id: true,
      },
    },
  });

  logger.log(
    `Found ${conversations.length} conversations for branch ${branchId}`,
  );

  return {
    conversations,
    total: conversations.length,
  };
};
