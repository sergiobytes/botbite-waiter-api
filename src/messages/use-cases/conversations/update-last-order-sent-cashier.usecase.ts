import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Conversation } from '../../entities/conversation.entity';
import { Repository } from 'typeorm';


@Injectable()
export class UpdateLastOrderSentToCashierUseCase {
  private readonly logger = new Logger(UpdateLastOrderSentToCashierUseCase.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
  ) { }

  async execute(conversationId: string, orderData: Record<string, { price: number; quantity: number; menuItemId: string; notes?: string }>,): Promise<void> {
    // Usar optimistic locking para evitar sobrescribir cambios concurrentes
    // Aumentado a 7 reintentos para soportar 100+ usuarios simultáneos
    const maxRetries = 7;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        // Obtener conversación actual con su versión
        const conversation = await this.conversationRepository.findOne({
          where: { conversationId },
        });

        if (!conversation) {
          this.logger.error(`Conversation not found: ${conversationId}`);
          return;
        }

        // Actualizar datos
        conversation.lastOrderSentToCashier = orderData;
        conversation.lastOrderSentAt = new Date();
        conversation.lastActivity = new Date();

        // save() verifica automáticamente la versión y lanza error si cambió
        await this.conversationRepository.save(conversation);

        this.logger.log(
          `Updated last order sent to cashier for conversation: ${conversationId}`,
        );
        return;
      } catch (error) {
        // Si falla por versión, reintentar
        if (error.message?.includes('version') || error.name === 'OptimisticLockVersionMismatchError') {
          retries++;
          this.logger.warn(
            `Optimistic lock conflict on conversation ${conversationId}, retry ${retries}/${maxRetries}`,
          );
          // Exponential backoff: 50ms * 2^retries + jitter aleatorio
          const backoffMs = Math.min(50 * Math.pow(2, retries) + Math.random() * 100, 5000);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        } else {
          throw error;
        }
      }
    }

    this.logger.error(
      `Failed to update conversation ${conversationId} after ${maxRetries} retries`,
    );
    throw new Error(`Optimistic lock failed after ${maxRetries} retries`);
  };
}