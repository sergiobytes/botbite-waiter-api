import { Injectable, Logger } from '@nestjs/common';
import { TemplatesService } from '../../../templates/templates.service';
import { Customer } from '../../../customers/entities/customer.entity';
import { Branch } from '../../../branches/entities/branch.entity';

export interface TemplateDetectionResult {
  shouldUseTemplate: boolean;
  response?: string;
}

@Injectable()
export class DetectTemplateResponseUseCase {
  private readonly logger = new Logger(DetectTemplateResponseUseCase.name);

  constructor(private readonly templatesService: TemplatesService) { }

  async execute(
    message: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    customerContext?: Customer,
    branchContext?: Branch,
    lastOrderSentToCashier?: Record<string, any> | null,
    preferredLanguage?: string | null,
  ): Promise<TemplateDetectionResult> {
    const messageLower = message.toLowerCase().trim();
    const language = preferredLanguage || 'es';

    try {
      // 0. CRITICAL: Check if this is language selection - DO NOT use template
      // Language selection should be handled by OpenAI with LANGUAGE_DETECTION_PROMPT
      const languageKeywords = [
        '🇲🇽',
        '🇺🇸',
        '🇫🇷',
        '🇰🇷',
        'español',
        'english',
        'français',
        'korean',
        '한국어',
        'german',
        'deutsch',
        'italiano',
        'italian',
        'português',
        'portuguese',
      ];

      if (languageKeywords.some((keyword) => messageLower.includes(keyword))) {
        this.logger.log('Detected: Language selection - skipping template, will use OpenAI');
        return { shouldUseTemplate: false };
      }

      // 1. Saludo inicial (primera interacción)
      // NOTE: This should rarely trigger now since language selection is the first real interaction
      if (conversationHistory.length === 0) {
        this.logger.log('Detected: Initial greeting');
        const response = await this.templatesService.render({
          key: 'greeting.initial',
          language,
          variables: {
            restaurantName:
              branchContext?.restaurant?.name || 'nuestro restaurante',
          },
        });
        return { shouldUseTemplate: true, response };
      }

      // 2. Saludo cliente frecuente
      if (
        (messageLower.includes('hola') ||
          messageLower.includes('hello') ||
          messageLower.includes('hi') ||
          messageLower.includes('buenos días') ||
          messageLower.includes('buenas tardes') ||
          messageLower.includes('good morning') ||
          messageLower.includes('good afternoon')) &&
        customerContext?.name &&
        conversationHistory.length > 0
      ) {
        this.logger.log('Detected: Returning customer greeting');
        const response = await this.templatesService.render({
          key: 'greeting.returning',
          language,
          variables: {
            customerName: customerContext.name,
            lastOrder: 'tu pedido favorito',
          },
        });
        return { shouldUseTemplate: true, response };
      }

      // 3. Solicitud de ayuda
      if (
        messageLower.includes('ayuda') ||
        messageLower.includes('help') ||
        messageLower === '?' ||
        messageLower.includes('qué puedes hacer') ||
        messageLower.includes('what can you do') ||
        messageLower.includes('opciones') ||
        messageLower.includes('options')
      ) {
        this.logger.log('Detected: Help request');
        const response = await this.templatesService.render({
          key: 'help.general',
          language,
          variables: {},
        });
        return { shouldUseTemplate: true, response };
      }

      // 4. Ver menú/categorías
      if (
        (messageLower.includes('menú') ||
          messageLower.includes('menu') ||
          messageLower.includes('categorías') ||
          messageLower.includes('categories') ||
          messageLower.includes('ver opciones') ||
          messageLower.includes('view options') ||
          messageLower.includes('qué tienen') ||
          messageLower.includes('what do you have')) &&
        !messageLower.includes('pagar') &&
        !messageLower.includes('pay')
      ) {
        this.logger.log('Detected: Menu categories request');
        const categories = this.extractMenuCategories(branchContext);

        if (categories.length > 0) {
          const response = await this.templatesService.render({
            key: 'menu.categories',
            language,
            variables: { categories },
          });
          return { shouldUseTemplate: true, response };
        }
      }

      // 5. Solicitud de métodos de pago (sin pedido previo)
      if (
        (messageLower.includes('cómo puedo pagar') ||
          messageLower.includes('métodos de pago') ||
          messageLower.includes('formas de pago') ||
          messageLower.includes('payment methods') ||
          messageLower.includes('how can i pay')) &&
        !lastOrderSentToCashier &&
        !messageLower.includes('cuenta') &&
        !messageLower.includes('bill')
      ) {
        this.logger.log('Detected: Payment methods request');
        const response = await this.templatesService.render({
          key: 'payment.methods',
          language,
          variables: {
            methods: [
              { name: 'Efectivo', description: 'Pago en efectivo al mesero' },
              {
                name: 'Tarjeta',
                description: 'Tarjeta de crédito o débito',
              },
              {
                name: 'Transferencia',
                description: 'Transferencia bancaria',
              },
            ],
          },
        });
        return { shouldUseTemplate: true, response };
      }

      // 6. Ver pedido actual (carrito vacío)
      if (
        (messageLower.includes('mi pedido') ||
          messageLower.includes('qué pedí') ||
          messageLower.includes('qué llevo') ||
          messageLower.includes('my order') ||
          messageLower.includes('what did i order')) &&
        (!lastOrderSentToCashier ||
          Object.keys(lastOrderSentToCashier).length === 0)
      ) {
        this.logger.log('Detected: Empty cart');
        const response = await this.templatesService.render({
          key: 'order.empty_cart',
          language,
          variables: {},
        });
        return { shouldUseTemplate: true, response };
      }

      // No se detectó intención con plantilla
      return { shouldUseTemplate: false };
    } catch (error) {
      this.logger.error(
        `Error detecting template response: ${error.message}`,
        error.stack,
      );
      return { shouldUseTemplate: false };
    }
  }

  private extractMenuCategories(branch?: Branch): Array<{ name: string }> {
    if (!branch?.menus) return [];

    const categoriesSet = new Set<string>();

    for (const menu of branch.menus) {
      if (!menu.menuItems) continue;

      for (const item of menu.menuItems) {
        if (item.category?.name) {
          categoriesSet.add(item.category.name);
        }
      }
    }

    return Array.from(categoriesSet).map((name) => ({ name }));
  }
}
