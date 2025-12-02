import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Conversation } from '../../entities/conversation.entity';
import { Repository } from 'typeorm';
import { ConversationMessage } from '../../entities/conversation-message.entity';
import { OpenAIService } from '../../../openai/services/openai.service';
import { Customer } from '../../../customers/entities/customer.entity';
import { Branch } from '../../../branches/entities/branch.entity';

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
    let conversation = await this.conversationRepository.findOne({
      where: { phoneNumber },
      relations: { messages: true },
      order: { lastActivity: 'DESC' },
    });

    if (!conversation) {
      const conversationId = this.openaiService.createConversation();

      conversation = this.conversationRepository.create({
        conversationId,
        phoneNumber,
        branchId,
        lastActivity: new Date(),
      });

      conversation = await this.conversationRepository.save(conversation);
      this.logger.log(`New conversation created for phone: ${phoneNumber}`);
    } else {
      conversation.lastActivity = new Date();
      await this.conversationRepository.save(conversation);
    }

    return conversation;
  }

  async saveMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
  ): Promise<ConversationMessage> {
    const message = this.messageRepository.create({
      conversationId,
      role,
      content,
    });

    return await this.messageRepository.save(message);
  }

  async getConversationHistory(
    conversationId: string,
    limit?: number,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const findOptions: any = {
      where: { conversationId },
      order: { createdAt: 'ASC' },
    };

    // Solo aplicar límite si se especifica explícitamente
    if (limit !== undefined) {
      findOptions.take = limit;
    }

    const messages = await this.messageRepository.find(findOptions);

    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  async processMessage(
    phoneNumber: string,
    userMessage: string,
    branchId?: string,
    customerContext?: Customer,
    branchContext?: Branch,
  ): Promise<string> {
    try {
      const conversation = await this.getOrCreateConversation(
        phoneNumber,
        branchId,
      );
      const history = await this.getConversationHistory(
        conversation.conversationId,
        50, // Aumentar límite para conversaciones más largas
      );

      await this.saveMessage(conversation.conversationId, 'user', userMessage);

      const assistantResponse = await this.openaiService.sendMessage(
        conversation.conversationId,
        userMessage,
        history,
        customerContext,
        branchContext,
      );

      await this.saveMessage(
        conversation.conversationId,
        'assistant',
        assistantResponse,
      );

      this.logger.log(
        `Message processed successfully for conversation: ${conversation.conversationId}`,
      );
      return assistantResponse;
    } catch (error) {
      this.logger.log('Error processing message: ', error);
      throw error;
    }
  }

  async updateLastOrderSentToCashier(
    conversationId: string,
    orderData: Record<
      string,
      { price: number; quantity: number; menuItemId?: string }
    >,
  ): Promise<void> {
    await this.conversationRepository.update(
      { conversationId },
      { lastOrderSentToCashier: orderData },
    );

    this.logger.log(
      `Updated last order sent to cashier for conversation: ${conversationId}`,
    );
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
