import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { CacheService } from '../../common/services/cache.service';
import { Customer } from '../../customers/entities/customer.entity';
import { OpenAIService } from '../../openai/openai.service';
import { ConversationMessage } from '../entities/conversation-message.entity';
import { Conversation } from '../entities/conversation.entity';
import { OrdersGateway } from '../gateways/orders.gateway';
import {
  ConversationHistoryResponse,
  ConversationsListResponse,
} from '../interfaces/messages.interfaces';
import { deleteConversationUseCase } from '../use-cases/conversations/delete-conversation.use-case';
import { findConversationsByBranchUseCase } from '../use-cases/conversations/find-conversations-by-branch.use-case';
import { getOrCreateConversationUseCase } from '../use-cases/conversations/get-create-conversation.use-case';
import { updateConversationLocationUseCase } from '../use-cases/conversations/update-conversation-location.use-case';
import { updateLastOrderSentToCashierUseCase } from '../use-cases/conversations/update-last-order-sent-cashier.use-case';
import { getConversationHistoryUseCase } from '../use-cases/messages/get-conversation-history.use-case';
import { processMessageUseCase } from '../use-cases/messages/process-message.use-case';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(ConversationMessage)
    private readonly messageRepository: Repository<ConversationMessage>,
    private readonly openaiService: OpenAIService,
    private readonly ordersGateway: OrdersGateway,
    private readonly cacheService: CacheService,
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
      cacheService: this.cacheService,
    });
  }

  async updateLastOrderSentToCashier(
    conversationId: string,
    orderData: Record<
      string,
      { price: number; quantity: number; menuItemId: string; notes?: string }
    >,
  ): Promise<void> {
    await updateLastOrderSentToCashierUseCase({
      conversationId,
      orderData,
      repository: this.conversationRepository,
      logger: this.logger,
    });

    const conversation = await this.conversationRepository.findOne({
      where: { conversationId },
      select: ['branchId'],
    });

    if (conversation?.branchId) {
      this.ordersGateway.emitOrderUpdate(conversation.branchId);
    }
  }

  async updateConversationLocation(
    conversationId: string,
    location: string,
  ): Promise<void> {
    return updateConversationLocationUseCase({
      conversationId,
      location,
      repository: this.conversationRepository,
      logger: this.logger,
    });
  }

  async findByBranch(branchId: string): Promise<ConversationsListResponse> {
    return findConversationsByBranchUseCase({
      branchId,
      repository: this.conversationRepository,
    });
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const conversation = await this.conversationRepository.findOne({
      where: { conversationId },
      select: ['branchId'],
    });

    await deleteConversationUseCase({
      conversationId,
      conversationRepository: this.conversationRepository,
      conversationMessageRepository: this.messageRepository,
      logger: this.logger,
    });

    if (conversation?.branchId) {
      this.ordersGateway.emitOrderUpdate(conversation.branchId);
    }
  }
}
