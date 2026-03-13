import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenAIService } from '../../../openai/openai.service';
import { Conversation } from '../../entities/conversation.entity';

@Injectable()
export class GetOrCreateConversationUseCase {

  private readonly logger = new Logger(GetOrCreateConversationUseCase.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    private readonly openaiService: OpenAIService,
  ) { }

  async execute(phoneNumber: string, branchId?: string,): Promise<Conversation> {

    // Usar transacción para evitar race conditions
    const queryRunner = this.conversationRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('READ COMMITTED');

    try {
      // Intentar obtener la conversación con lock FOR UPDATE
      let conversation = (await queryRunner.manager
        .createQueryBuilder()
        .select('conversation')
        .from('conversations', 'conversation')
        .where('conversation.phoneNumber = :phoneNumber', { phoneNumber })
        .setLock('pessimistic_write') // Lock para evitar duplicados
        .getOne()) as Conversation | null;

      if (conversation) {
        // Actualizar lastActivity
        conversation.lastActivity = new Date();
        await queryRunner.manager.save(conversation);
      } else {
        // Crear nueva conversación
        const id = this.openaiService.createConversation();

        conversation = this.conversationRepository.create({
          conversationId: id,
          phoneNumber,
          branchId,
          lastActivity: new Date(),
        });

        await queryRunner.manager.save(conversation);
        this.logger.log(`New conversation created for phone: ${phoneNumber}`);
      }

      await queryRunner.commitTransaction();

      // Return the conversation from the transaction context
      // No need to reload with messages since they're not used immediately
      if (!conversation) {
        throw new Error(
          `Conversation object is null after transaction for phone ${phoneNumber}`,
        );
      }

      this.logger.log(
        `Returning conversation ${conversation.conversationId} for phone ${phoneNumber}`,
      );

      return conversation;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error in getOrCreateConversation: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

