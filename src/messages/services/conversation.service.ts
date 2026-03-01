import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../../branches/entities/branch.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { Conversation } from '../entities/conversation.entity';
import { OrdersGateway } from '../gateways/orders.gateway';
import { ConversationHistoryResponse, ConversationsListResponse, } from '../interfaces/messages.interfaces';
import { DeleteConversationUseCase } from '../use-cases/conversations/delete-conversation.usecase';
import { FindConversationsByBranchUseCase } from '../use-cases/conversations/find-conversations-by-branch.usecase';
import { GetOrCreateConversationUseCase } from '../use-cases/conversations/get-create-conversation.usecase';
import { UpdateConversationLocationUseCase } from '../use-cases/conversations/update-conversation-location.usecase';
import { UpdateLastOrderSentToCashierUseCase } from '../use-cases/conversations/update-last-order-sent-cashier.usecase';
import { GetConversationHistoryUseCase } from '../use-cases/messages/get-conversation-history.usecase';
import { ProcessMessageUseCase } from '../use-cases/messages/process-message.usecase';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    private readonly ordersGateway: OrdersGateway,
    private readonly getOrCreateConversationUseCase: GetOrCreateConversationUseCase,
    private readonly getConversationHistoryUseCase: GetConversationHistoryUseCase,
    private readonly processMessageUseCase: ProcessMessageUseCase,
    private readonly updateLastOrderSentToCashierUseCase: UpdateLastOrderSentToCashierUseCase,
    private readonly updateConversationLocationUseCase: UpdateConversationLocationUseCase,
    private readonly findConversationsByBranchUseCase: FindConversationsByBranchUseCase,
    private readonly deleteConversationUseCase: DeleteConversationUseCase
  ) { }

  async getOrCreateConversation(phoneNumber: string, branchId?: string,): Promise<Conversation> {
    return await this.getOrCreateConversationUseCase.execute(phoneNumber, branchId);
  }

  async getConversationHistory(conversationId: string,): Promise<ConversationHistoryResponse> {
    return await this.getConversationHistoryUseCase.execute(conversationId);
  }

  async processMessage(phoneNumber: string, userMessage: string, branchId?: string, customerContext?: Customer, branchContext?: Branch,): Promise<string> {
    return await this.processMessageUseCase.execute(phoneNumber, userMessage, branchId, customerContext, branchContext);
  }

  async updateLastOrderSentToCashier(conversationId: string, orderData: Record<string, { price: number; quantity: number; menuItemId: string; notes?: string }>,): Promise<void> {
    await this.updateLastOrderSentToCashierUseCase.execute(conversationId, orderData);

    const conversation = await this.conversationRepository.findOne({
      where: { conversationId },
      select: { branchId: true },
    });

    if (conversation?.branchId) {
      this.ordersGateway.emitOrderUpdate(conversation.branchId);
    }
  }

  async updateConversationLocation(conversationId: string, location: string,): Promise<void> {
    return await this.updateConversationLocationUseCase.execute(conversationId, location);
  }

  async updatePreferredLanguage(conversationId: string, language: string,): Promise<void> {
    this.logger.log(
      `Updating preferred language for conversation ${conversationId} to: ${language}`,
    );
    await this.conversationRepository.update(
      { conversationId },
      { preferredLanguage: language },
    );
  }

  async findByBranch(branchId: string): Promise<ConversationsListResponse> {
    return await this.findConversationsByBranchUseCase.execute(branchId);
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const conversation = await this.conversationRepository.findOne({
      where: { conversationId },
      select: ['branchId'],
    });

    await this.deleteConversationUseCase.execute(conversationId);

    if (conversation?.branchId) {
      this.ordersGateway.emitOrderUpdate(conversation.branchId);
    }
  }
}
