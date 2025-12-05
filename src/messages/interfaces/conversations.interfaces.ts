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
