import { Repository, LessThan } from 'typeorm';
import { Conversation } from '../../entities/conversation.entity';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class CleanupOldConversationsUseCase {
  private readonly logger = new Logger(CleanupOldConversationsUseCase.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
  ) { }

  async execute(): Promise<number> {
    // Calcular fecha límite: 24 horas atrás
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    try {
      // Buscar conversaciones inactivas por más de 24 horas
      const oldConversations = await this.conversationRepository.find({
        where: {
          lastActivity: LessThan(twentyFourHoursAgo),
        },
      });

      if (oldConversations.length === 0) {
        this.logger.log('No old conversations to clean up');
        return 0;
      }

      // Borrar conversaciones encontradas
      await this.conversationRepository.remove(oldConversations);

      this.logger.log(
        `Successfully cleaned up ${oldConversations.length} conversations older than 24 hours`,
      );

      return oldConversations.length;
    } catch (error) {
      this.logger.error('Error cleaning up old conversations', error);
      throw error;
    }
  };
}