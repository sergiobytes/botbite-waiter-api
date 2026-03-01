import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { ConversationMessage } from '../../entities/conversation-message.entity';
import { ConversationHistoryResponse, } from '../../interfaces/messages.interfaces';

@Injectable()
export class GetConversationHistoryUseCase {
  private readonly logger = new Logger(GetConversationHistoryUseCase.name);

  constructor(
    @InjectRepository(ConversationMessage)
    private readonly messageRepository: Repository<ConversationMessage>,
  ) { }

  async execute(conversationId: string): Promise<ConversationHistoryResponse> {
    const findOptions: FindManyOptions<ConversationMessage> = {
      where: { conversationId },
      order: { createdAt: 'ASC' },
    };

    const messages = await this.messageRepository.find(findOptions);

    this.logger.debug(`Found ${messages.length} messages for conversation ${conversationId}`);

    return {
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    };
  };
}