import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversationMessage } from '../../entities/conversation-message.entity';

@Injectable()
export class SaveMessageUseCase {
  private readonly logger = new Logger(SaveMessageUseCase.name);

  constructor(
    @InjectRepository(ConversationMessage)
    private readonly messageRepository: Repository<ConversationMessage>,
  ) { }

  async execute(conversationId: string, role: 'user' | 'assistant', content: string): Promise<ConversationMessage> {


    if (!conversationId) {
      this.logger.error(`Cannot save message: conversationId is null or undefined`);
      throw new Error(`Cannot save message: conversationId is null or undefined`);
    }

    const message = this.messageRepository.create({
      conversationId,
      role,
      content,
    });

    await this.messageRepository.save(message);

    this.logger.log(`Message saved successfully: ${message.id} in conversation ${conversationId}`);

    return message;
  };
}