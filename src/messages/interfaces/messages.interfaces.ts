import { Repository } from 'typeorm';
import { ConversationMessage } from '../entities/conversation-message.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { Logger } from '@nestjs/common';
import { Conversation } from '../entities/conversation.entity';
import { OpenAIService } from '../../openai/services/openai.service';

export interface SaveMessage {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  repository: Repository<ConversationMessage>;
}

export interface GetConversationHistory {
  conversationId: string;
  repository: Repository<ConversationMessage>;
}

export interface ProcessMessage {
  phoneNumber: string;
  userMessage: string;
  branchId?: string;
  customerContext?: Customer;
  branchContext?: Branch;
  logger: Logger;
  conversationMessageRepository: Repository<ConversationMessage>;
  conversationRepository: Repository<Conversation>;
  service: OpenAIService;
}

export interface ConversationHistoryResponse {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}
