import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import PQueue from 'p-queue';
import { openAIConfig } from '../config/openai.config';
import { Customer } from '../customers/entities/customer.entity';
import { Branch } from '../branches/entities/branch.entity';
import { openAiCreateConversationUseCase } from './use-cases/open-ai-create-conversation.use-case';
import { openAiSendMessageUseCase } from './use-cases/open-ai-send-message.use-case';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly openai: OpenAI;
  private readonly queue: PQueue;

  constructor() {
    if (!openAIConfig.apiKey) {
      this.logger.warn('OpenAI API key not configured');
      return;
    }

    this.openai = new OpenAI({
      apiKey: openAIConfig.apiKey,
    });

    // Cola optimizada para respuesta estable con múltiples usuarios
    // Tier 1 de OpenAI: 500 RPM (requests/min), 30K TPM (tokens/min)
    // Concurrencia reducida para evitar timeouts de OpenAI bajo carga
    this.queue = new PQueue({
      concurrency: 10, // Máximo 10 llamadas simultáneas (optimizado para estabilidad)
      interval: 60000, // Intervalo de 1 minuto
      intervalCap: 400, // Máximo 400 requests por minuto (80% del límite de 500 RPM)
      timeout: 120000, // 2 minutos timeout en cola
    });

    this.logger.log('OpenAI service initialized (concurrency: 10, rate: 400/min, optimized for stability)');
  }

  createConversation(): string {
    return openAiCreateConversationUseCase();
  }

  async sendMessage(
    conversationId: string,
    message: string,
    conversationHistory: Array<{
      role: 'user' | 'assistant';
      content: string;
    }> = [],
    customerContext?: Customer,
    branchContext?: Branch,
  ): Promise<string> {
    // Encolar la llamada para evitar sobrecarga
    return this.queue.add(
      async () => {
        this.logger.log(
          `Processing OpenAI request for conversation ${conversationId} (queue size: ${this.queue.size}, pending: ${this.queue.pending})`,
        );
        
        return openAiSendMessageUseCase({
          conversationId,
          message,
          conversationHistory,
          customerContext,
          branchContext,
          openai: this.openai,
          logger: this.logger,
        });
      },
      { priority: 1 }, // Prioridad normal
    );
  }
}
