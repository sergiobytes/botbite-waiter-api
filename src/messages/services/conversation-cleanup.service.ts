import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { cleanupOldConversationsUseCase } from '../use-cases/conversations/cleanup-old-conversations.use-case';

@Injectable()
export class ConversationCleanupService {
  private readonly logger = new Logger(ConversationCleanupService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDailyCleanup() {
    this.logger.log('Starting daily conversation cleanup task');

    try {
      const deletedCount = await cleanupOldConversationsUseCase(
        this.conversationRepository,
        this.logger,
      );

      this.logger.log(
        `Daily cleanup completed. Deleted ${deletedCount} old conversations`,
      );
    } catch (error) {
      this.logger.error('Daily cleanup task failed', error);
    }
  }

  async cleanupNow(): Promise<number> {
    this.logger.log('Manual conversation cleanup triggered');

    return cleanupOldConversationsUseCase(
      this.conversationRepository,
      this.logger,
    );
  }
}
