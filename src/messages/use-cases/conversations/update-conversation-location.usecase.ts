import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Conversation } from '../../entities/conversation.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UpdateConversationLocationUseCase {
  private readonly logger = new Logger(UpdateConversationLocationUseCase.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
  ) { }

  async execute(conversationId: string, location: string,): Promise<void> {
    try {
      const conversation = await this.conversationRepository.findOne({
        where: { conversationId },
      });

      if (!conversation) {
        this.logger.error(`Conversation not found: ${conversationId}`);
        return;
      }

      // Solo actualizar si no hay ubicación previa o si cambió
      if (conversation.location !== location) {
        conversation.location = location;
        conversation.lastActivity = new Date();
        await this.conversationRepository.save(conversation);

        this.logger.log(
          `Updated location for conversation ${conversationId}: ${location}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error updating conversation location for ${conversationId}:`,
        error,
      );
    }
  };
}