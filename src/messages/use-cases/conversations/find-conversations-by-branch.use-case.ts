import {
  ConversationsListResponse,
  FindConversationsByBranch,
} from '../../interfaces/conversations.interfaces';
import { IsNull, Not } from 'typeorm';

export const findConversationsByBranchUseCase = async (
  params: FindConversationsByBranch,
): Promise<ConversationsListResponse> => {
  const { branchId, repository } = params;

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
      customer: true,
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
      customer: {
        name: true,
      },
    },
  });

  return {
    conversations,
    total: conversations.length,
  };
};
