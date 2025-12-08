import { Customer } from '../../customers/entities/customer.entity';
import { Branch } from '../../branches/entities/branch.entity';
import OpenAI from 'openai';
import { Logger } from '@nestjs/common';

export interface OpenAiSendMessage {
  conversationId: string;
  message: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  customerContext?: Customer;
  branchContext?: Branch;
  openai: OpenAI;
  logger: Logger;
}
