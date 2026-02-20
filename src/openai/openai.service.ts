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

        this.logger.log(
          `Using OpenAI for conversation: ${conversationId} (no template match)`,
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
   * Intenta usar una plantilla para responder al mensaje
   * Retorna null si no hay plantilla aplicable
   */
  private async tryUseTemplate(
    message: string,
    conversationHistory: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>,
    customerContext?: Customer,
    branchContext?: Branch,
    lastOrderSentToCashier?: Record<
      string,
      { price: number; quantity: number; menuItemId: string; notes?: string }
    > | null,
    preferredLanguage?: string | null,
  ): Promise<string | null> {
    try {
      const messageLower = message.toLowerCase().trim();
      const language = preferredLanguage || 'es';

      // Detectar si es el primer mensaje - Saludo inicial
      if (conversationHistory.length === 0) {
        return this.templatesService.render({
          key: 'greeting.initial',
          language,
          variables: {
            restaurantName:
              branchContext?.restaurant?.name || 'nuestro restaurante',
          },
        });
      }

      // Detectar saludo para cliente frecuente
      const isReturningGreeting =
        (messageLower.includes('hola') ||
          messageLower.includes('hello') ||
          messageLower.includes('hi')) &&
        customerContext?.name &&
        conversationHistory.length > 0;

      if (isReturningGreeting) {
        const lastOrder = this.getLastOrderName();
        if (lastOrder) {
          return this.templatesService.render({
            key: 'greeting.returning',
            language,
            variables: {
              customerName: customerContext.name,
              lastOrder,
            },
          });
        }
      }

      // Detectar solicitud de ayuda
      if (
        messageLower.includes('ayuda') ||
        messageLower.includes('help') ||
        messageLower.includes('aide') ||
        messageLower === '?' ||
        messageLower.includes('qué puedes hacer') ||
        messageLower.includes('what can you do')
      ) {
        return this.templatesService.render({
          key: 'help.general',
          language,
          variables: {},
        });
      }

      // Detectar solicitud de categorías del menú
      if (
        (messageLower.includes('menú') ||
          messageLower.includes('menu') ||
          messageLower.includes('categorías') ||
          messageLower.includes('categories') ||
          messageLower.includes('opciones')) &&
        branchContext?.menus
      ) {
        const categories = this.extractMenuCategories(branchContext);
        if (categories.length > 0) {
          return this.templatesService.render({
            key: 'menu.categories',
            language,
            variables: { categories },
          });
        }
      }

      // Detectar confirmación de pedido
      const isConfirmation =
        messageLower.includes('confirmar') ||
        messageLower.includes('confirm') ||
        messageLower.includes('sí') ||
        messageLower.includes('si') ||
        messageLower === 'yes' ||
        messageLower.includes('correcto') ||
        messageLower.includes('correct');

      const lastBotMessage =
        conversationHistory.length > 0
          ? conversationHistory[conversationHistory.length - 1]
          : null;

      const botAskedForConfirmation =
        lastBotMessage?.role === 'assistant' &&
        (lastBotMessage.content.includes('confirmar') ||
          lastBotMessage.content.includes('confirm') ||
          lastBotMessage.content.includes('correcto') ||
          lastBotMessage.content.includes('correct'));

      if (isConfirmation && botAskedForConfirmation && lastOrderSentToCashier) {
        const orderVariables = this.extractOrderVariables(
          lastOrderSentToCashier,
          branchContext,
        );
        return this.templatesService.render({
          key: 'order.confirmation',
          language,
          variables: orderVariables,
        });
      }

      // Detectar cuentas separadas
      const isSeparateBills =
        messageLower.includes('separada') ||
        messageLower.includes('separado') ||
        messageLower.includes('separate') ||
        messageLower.includes('cada quien') ||
        messageLower.includes('each person') ||
        messageLower.includes('dividir') ||
        messageLower.includes('split');

      if (isSeparateBills && lastOrderSentToCashier) {
        // Para cuentas separadas, aún necesitamos OpenAI para procesar la división
        // Esta es una operación compleja
        return null;
      }

      // Detectar métodos de pago
      if (
        messageLower.includes('pagar') ||
        messageLower.includes('pay') ||
        messageLower.includes('payment') ||
        messageLower.includes('forma de pago') ||
        messageLower.includes('método') ||
        messageLower.includes('method')
      ) {
        return this.templatesService.render({
          key: 'payment.methods',
          language,
          variables: {
            methods: [
              { name: 'Efectivo', description: 'Pago en efectivo' },
              { name: 'Tarjeta', description: 'Débito o crédito' },
              { name: 'Transferencia', description: 'Transferencia bancaria' },
            ],
          },
        });
      }

      // Otras intenciones complejas requieren OpenAI
      return null;
    } catch (error) {
      this.logger.error(
        'Error rendering template, falling back to OpenAI',
        error,
      );
      return null;
    }
  }

  /**
   * Extrae el nombre del último pedido del cliente
   */
  private getLastOrderName(): string | null {
    // TODO: Implementar lógica para obtener el último pedido del cliente
    // Por ahora retornamos null para usar OpenAI
    return null;
  }

  /**
   * Extrae las categorías del menú
   */
  private extractMenuCategories(branch: Branch): Array<{ name: string }> {
    const categories: Array<{ name: string }> = [];
    const seenCategories = new Set<string>();

    if (branch.menus) {
      for (const menu of branch.menus) {
        if (menu.menuItems) {
          for (const menuItem of menu.menuItems) {
            if (
              menuItem.category &&
              !seenCategories.has(menuItem.category.name)
            ) {
              categories.push({ name: menuItem.category.name });
              seenCategories.add(menuItem.category.name);
            }
          }
        }
      }
    }

    return categories;
  }

  /**
   * Extrae variables del pedido para plantillas
   */
  private extractOrderVariables(
    order: Record<
      string,
      { price: number; quantity: number; menuItemId: string; notes?: string }
    >,
    branch?: Branch,
  ): Record<string, any> {
    const items: Array<{
      name: string;
      quantity: number;
      price: number;
    }> = [];

    let total = 0;

    for (const [key, item] of Object.entries(order)) {
      const productName = this.findProductName(item.menuItemId, branch) || key;
      const subtotal = item.price * item.quantity;
      total += subtotal;

      items.push({
        name: productName,
        quantity: item.quantity,
        price: subtotal,
      });
    }

    return {
      orderNumber: this.generateOrderNumber(),
      items,
      total: total.toFixed(2),
      estimatedTime: 25, // Tiempo estimado por defecto
    };
  }

  /**
   * Encuentra el nombre del producto por ID del menu item
   */
  private findProductName(menuItemId: string, branch?: Branch): string | null {
    if (!branch?.menus) return null;

    for (const menu of branch.menus) {
      if (menu.menuItems) {
        const item = menu.menuItems.find((mi) => mi.id === menuItemId);
        if (item?.product) {
          return item.product.name;
        }
      }
    }

    return null;
  }

  /**
   * Genera un número de orden único
   */
  private generateOrderNumber(): string {
    return `${Date.now().toString().slice(-6)}`;
  }
}
