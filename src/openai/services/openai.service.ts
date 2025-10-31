import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import OpenAI from 'openai';
import { openAIConfig } from '../../config/openai.config';
import { AssistantService } from '../assistant.service';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly openai: OpenAI;

  constructor(
    @Inject(forwardRef(() => AssistantService))
    private readonly assistantService: AssistantService,
  ) {
    if (!openAIConfig.apiKey) {
      this.logger.warn('OpenAI API key not configured');
      return;
    }

    this.openai = new OpenAI({
      apiKey: openAIConfig.apiKey,
    });

    this.logger.log('OpenAI service initialized');
  }

  /**
   * Crea un thread de conversación con el asistente
   */
  async createThread(): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }

    const thread = await this.openai.beta.threads.create();
    this.logger.log(`Thread created: ${thread.id}`);
    return thread.id;
  }

  /**
   * Envía un mensaje al asistente y obtiene la respuesta
   */
  async sendMessageToAssistant(
    assistantId: string,
    threadId: string,
    message: string,
    customerContext?: any,
  ): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI not configured');
    }

    try {
      // 1. Agregar el mensaje del usuario al thread
      await this.openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: message,
      });

      // 2. Crear un run con el asistente
      const run = await this.openai.beta.threads.runs.create(threadId, {
        assistant_id: assistantId,
        additional_instructions: customerContext
          ? `Contexto del cliente: ${JSON.stringify(customerContext)}`
          : undefined,
      });

      // 3. Esperar a que el run se complete
      let runStatus = await this.openai.beta.threads.runs.retrieve(run.id, {
        thread_id: threadId,
      });

      while (
        runStatus.status === 'in_progress' ||
        runStatus.status === 'queued'
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        runStatus = await this.openai.beta.threads.runs.retrieve(run.id, {
          thread_id: threadId,
        });
      }

      if (runStatus.status === 'completed') {
        // 4. Obtener los mensajes del thread
        const messages = await this.openai.beta.threads.messages.list(threadId);
        const lastMessage = messages.data[0];

        if (lastMessage.role === 'assistant') {
          const content = lastMessage.content[0];
          if (content.type === 'text') {
            return content.text.value;
          }
        }
      } else {
        this.logger.error(`Run failed with status: ${runStatus.status}`);
        throw new Error(`Assistant run failed: ${runStatus.status}`);
      }

      return 'Lo siento, no pude procesar tu mensaje. ¿Puedes intentar de nuevo?';
    } catch (error) {
      this.logger.error('Error communicating with OpenAI:', error);
      throw error;
    }
  }
}
