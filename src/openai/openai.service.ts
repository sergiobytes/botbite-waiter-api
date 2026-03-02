import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import PQueue from 'p-queue';
import { openAIConfig } from '../config/openai.config';
import { Customer } from '../customers/entities/customer.entity';
import { Branch } from '../branches/entities/branch.entity';
import { openAiCreateConversationUseCase } from './use-cases/open-ai-create-conversation.use-case';
import { openAiSendMessageUseCase } from './use-cases/open-ai-send-message.use-case';
import { TemplatesService } from '../templates/templates.service';
import { ProcessOrderWithAIUseCase } from './use-cases/process-order-with-ai.use-case';
import { TEMPLATE_KEYS } from '../templates/constants/template-keys.constants';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly openai: OpenAI;
  private readonly queue: PQueue;

  constructor(
    private readonly templatesService: TemplatesService,
    private readonly processOrderWithAIUseCase: ProcessOrderWithAIUseCase,
  ) {
    if (!openAIConfig.apiKey) {
      this.logger.warn('OpenAI API key not configured');
      return;
    }

    this.openai = new OpenAI({
      apiKey: openAIConfig.apiKey,
    });

    this.queue = new PQueue({
      concurrency: 3,
      interval: 60000,
      intervalCap: 400,
      timeout: 120000,
    });

    this.logger.log(
      'OpenAI service initialized with templates support (concurrency: 3, rate: 400/min, optimized to avoid rate limits)',
    );
  }

  createConversation(): string {
    return openAiCreateConversationUseCase();
  }

  /**
   * Obtiene la instancia de OpenAI para uso en use cases
   */
  getOpenAI(): OpenAI {
    return this.openai;
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
    conversationLocation?: string | null,
    lastOrderSentToCashier?: Record<
      string,
      { price: number; quantity: number; menuItemId: string; notes?: string }
    > | null,
    preferredLanguage?: string | null,
  ): Promise<string> {
    // Encolar la llamada para evitar sobrecarga
    return this.queue.add(
      async () => {
        const orderAction = this.detectOrderAction(message);

        if (orderAction) {
          this.logger.log(`Detected order action: ${orderAction}`);

          const processOrder = await this.processOrderWithAIUseCase.execute(
            this.openai,
            message,
            conversationHistory,
            lastOrderSentToCashier || {},
            branchContext,
          );

          return this.renderOrderResponse(
            processOrder,
            preferredLanguage || 'es',
          );
        }

        this.logger.log(
          `Processing request for conversation ${conversationId} (queue size: ${this.queue.size}, pending: ${this.queue.pending})`,
        );

        // NOTA: La lógica de plantillas ahora se maneja en el messages module
        // mediante DetectTemplateResponseUseCase antes de llegar aquí
        // Este servicio solo maneja procesamiento con IA cuando las plantillas no aplican

        /*
        const templateResponse = await this.tryUseTemplate(
          message,
          conversationHistory,
          customerContext,
          branchContext,
          lastOrderSentToCashier,
          preferredLanguage,
        );

        if (templateResponse) {
          this.logger.log(
            `Response generated using template for conversation: ${conversationId}`,
          );
          return templateResponse;
        }
        */

        this.logger.log(
          `Using OpenAI for conversation: ${conversationId}`,
        );

        return openAiSendMessageUseCase({
          conversationId,
          message,
          conversationHistory,
          customerContext,
          branchContext,
          conversationLocation,
          lastOrderSentToCashier,
          preferredLanguage,
          openai: this.openai,
          logger: this.logger,
        });
      },
      { priority: 1 },
    );
  }

  /**
   * Detecta si el mensaje es una acción sobre pedidos
   */
  private detectOrderAction(message: string): string | null {
    const messageLower = message.toLowerCase().trim();

    // Agregar items
    if (
      messageLower.includes('quiero') ||
      messageLower.includes('pedir') ||
      messageLower.includes('ordenar') ||
      messageLower.includes('agregar') ||
      messageLower.includes('añadir') ||
      messageLower.match(/\d+\s*(pizza|hamburguesa|refresco|bebida|platillo)/i)
    ) {
      return 'add_items';
    }

    // Solicitar cuenta
    if (
      messageLower.includes('cuenta') ||
      messageLower.includes('pagar') ||
      messageLower.includes('cuánto es') ||
      messageLower.includes('total')
    ) {
      return 'request_bill';
    }

    // Cuentas separadas
    if (
      messageLower.includes('separada') ||
      messageLower.includes('separado') ||
      messageLower.includes('cada quien') ||
      messageLower.includes('dividir')
    ) {
      return 'separate_bills';
    }

    // Confirmar pedido
    if (
      messageLower.includes('confirmar') ||
      messageLower.includes('sí') ||
      messageLower.includes('si') ||
      messageLower.includes('ok') ||
      messageLower.includes('correcto')
    ) {
      return 'confirm';
    }

    // Ver carrito
    if (
      messageLower.includes('mi pedido') ||
      messageLower.includes('qué pedí') ||
      messageLower.includes('qué llevo')
    ) {
      return 'show_cart';
    }

    // Modificar
    if (
      messageLower.includes('quitar') ||
      messageLower.includes('eliminar') ||
      messageLower.includes('cambiar') ||
      messageLower.includes('modificar')
    ) {
      return 'modify';
    }

    return null;
  }

  /**
   * Renderiza la respuesta usando la plantilla apropiada
   */
  private async renderOrderResponse(
    processedOrder: any,
    language: string,
  ): Promise<string> {
    try {
      let templateKey: string;
      let variables: any;

      switch (processedOrder.action) {
        case 'add':
          templateKey = TEMPLATE_KEYS.ORDER_ITEMS_ADDED;
          variables = {
            items: processedOrder.items,
            currentTotal: processedOrder.currentTotal.toFixed(2),
          };
          break;

        case 'request_bill':
          templateKey = TEMPLATE_KEYS.ORDER_REQUEST_BILL;
          variables = {
            items: processedOrder.items || [],
            total: processedOrder.currentTotal.toFixed(2),
          };
          break;

        case 'separate_bills':
          templateKey = TEMPLATE_KEYS.ORDER_SEPARATE_BILLS;
          variables = {
            bills: processedOrder.separateBills,
            grandTotal: processedOrder.currentTotal.toFixed(2),
          };
          break;

        case 'confirm':
          templateKey = TEMPLATE_KEYS.ORDER_CONFIRMATION;
          variables = {
            orderNumber: this.generateOrderNumber(),
            items: processedOrder.items || [],
            total: processedOrder.currentTotal.toFixed(2),
            estimatedTime: 25,
          };
          break;

        case 'show_cart':
          if (!processedOrder.items || processedOrder.items.length === 0) {
            templateKey = TEMPLATE_KEYS.ORDER_EMPTY_CART;
            variables = {};
          } else {
            templateKey = TEMPLATE_KEYS.ORDER_ITEMS_ADDED;
            variables = {
              items: processedOrder.items,
              currentTotal: processedOrder.currentTotal.toFixed(2),
            };
          }
          break;

        default:
          // Si no hay plantilla, retornar mensaje de la IA
          return processedOrder.message || 'Procesando tu solicitud...';
      }

      return this.templatesService.render({
        key: templateKey,
        language,
        variables,
      });
    } catch (error) {
      this.logger.error(`Error rendering order response: ${error.message}`);
      // Fallback a mensaje simple
      return processedOrder.message || 'He procesado tu solicitud.';
    }
  }


  /**
   * Genera un número de orden único
   */
  private generateOrderNumber(): string {
    return `${Date.now().toString().slice(-6)}`;
  }
}
