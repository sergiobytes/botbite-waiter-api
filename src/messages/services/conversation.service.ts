import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Conversation } from '../entities/conversation.entity';
import { Repository } from 'typeorm';
import { ConversationMessage } from '../entities/conversation-message.entity';
import { OpenAIService } from '../../openai/services/openai.service';
import { Customer } from '../../customers/entities/customer.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { getOrCreateConversationUseCase } from '../use-cases/conversations/get-create-conversation.use-case';
import { ConversationHistoryResponse } from '../interfaces/messages.interfaces';
import { getConversationHistoryUseCase } from '../use-cases/messages/get-conversation-history.use-case';
import { processMessageUseCase } from '../use-cases/messages/process-message.use-case';
import { updateLastOrderSentToCashierUseCase } from '../use-cases/conversations/update-last-order-sent-cashier.use-case';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(ConversationMessage)
    private readonly messageRepository: Repository<ConversationMessage>,
    private readonly openaiService: OpenAIService,
  ) {}

  async getOrCreateConversation(
    phoneNumber: string,
    branchId?: string,
  ): Promise<Conversation> {
    return getOrCreateConversationUseCase({
      phoneNumber,
      branchId,
      repository: this.conversationRepository,
      service: this.openaiService,
      logger: this.logger,
    });
  }

  async getConversationHistory(
    conversationId: string,
  ): Promise<ConversationHistoryResponse> {
    return getConversationHistoryUseCase({
      conversationId,
      repository: this.messageRepository,
    });
  }

  async processMessage(
    phoneNumber: string,
    userMessage: string,
    branchId?: string,
    customerContext?: Customer,
    branchContext?: Branch,
  ): Promise<string> {
    return processMessageUseCase({
      phoneNumber,
      userMessage,
      branchId,
      customerContext,
      branchContext,
      logger: this.logger,
      conversationRepository: this.conversationRepository,
      conversationMessageRepository: this.messageRepository,
      service: this.openaiService,
    });
  }

  async updateLastOrderSentToCashier(
    conversationId: string,
    orderData: Record<
      string,
      { price: number; quantity: number; menuItemId: string; notes?: string }
    >,
  ): Promise<void> {
    return updateLastOrderSentToCashierUseCase({
      conversationId,
      orderData,
      repository: this.conversationRepository,
      logger: this.logger,
    });
  }

  async deleteConversation(conversationId: string): Promise<void> {
    try {
      await this.messageRepository.delete({ conversationId });

      await this.conversationRepository.delete({ conversationId });

      this.logger.log(
        `Conversation and all its messages deleted: ${conversationId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error deleting conversation ${conversationId}:`,
        error,
      );
      throw error;
    }
  }
}
