import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { openAIConfig } from '../config/openai.config';
import { Customer } from '../customers/entities/customer.entity';
import { Branch } from '../branches/entities/branch.entity';
import { openAiCreateConversationUseCase } from './use-cases/open-ai-create-conversation.use-case';
import { openAiSendMessageUseCase } from './use-cases/open-ai-send-message.use-case';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly openai: OpenAI;

  constructor() {
    if (!openAIConfig.apiKey) {
      this.logger.warn('OpenAI API key not configured');
      return;
    }

    this.openai = new OpenAI({
      apiKey: openAIConfig.apiKey,
    });

    this.logger.log('OpenAI service initialized');
  }

  createConversation(): string {
    return openAiCreateConversationUseCase();
  }

  async sendMessage(
    conversationId: string,
    message: string,
    conversationHistory: Array<{
      role: 'user' | 'assistant';
      content: string;
    }> = [],
    customerContext?: Customer,
    branchContext?: Branch,
  ): Promise<string> {
    return openAiSendMessageUseCase({
      conversationId,
      message,
      conversationHistory,
      customerContext,
      branchContext,
      openai: this.openai,
      logger: this.logger,
    });
  }
}
