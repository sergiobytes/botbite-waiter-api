import { Repository } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { OpenAIService } from '../../openai/services/openai.service';
import { Logger } from '@nestjs/common';

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
