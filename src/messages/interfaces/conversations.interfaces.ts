import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { OpenAIService } from '../../openai/openai.service';
import { ConversationMessage } from '../entities/conversation-message.entity';
import { Conversation } from '../entities/conversation.entity';

export interface GetCreateConversation {
  phoneNumber: string;
  branchId?: string;
  repository: Repository<Conversation>;
  service: OpenAIService;
  logger: Logger;
}

export interface LastOrderSentToCashier {
  conversationId: string;
  logger: Logger;
  repository: Repository<Conversation>;
  orderData: Record<
    string,
    { price: number; quantity: number; menuItemId: string; notes?: string }
  >;
}

export interface DeleteConversation {
  conversationId: string;
  conversationRepository: Repository<Conversation>;
  conversationMessageRepository: Repository<ConversationMessage>;
  logger: Logger;
}

export interface FindConversationsByBranch {
  branchId: string;
  repository: Repository<Conversation>;
}

export interface ConversationsListResponse {
  conversations: Conversation[];
  total: number;
}
