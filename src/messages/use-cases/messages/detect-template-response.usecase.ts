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
      // 💡 PRIORITY 0: Detectar respuesta afirmativa a pregunta de foto de producto
      const lastBotMessage =
        conversationHistory.length > 0
          ? conversationHistory[conversationHistory.length - 1]
          : null;

      if (lastBotMessage && lastBotMessage.role === 'assistant') {
        this.logger.log(`[PHOTO DETECTION] Last bot message: "${lastBotMessage.content.substring(0, 150)}..."`);

        const photoQuestionPattern = /¿te\s+gustaría\s+ver\s+una\s+foto\s+de\s+los?\s+\*([^*]+)\*|would\s+you\s+like\s+to\s+see\s+a\s+photo\s+of\s+(?:the\s+)?\*([^*]+)\*|souhaitez-vous\s+voir\s+une\s+photo\s+(?:du\s+|de\s+la\s+)?\*([^*]+)\*/i;
        const photoQuestionMatch = lastBotMessage.content.match(
          photoQuestionPattern,
        );

        if (photoQuestionMatch) {
          this.logger.log(`[PHOTO DETECTION] ✅ Photo question detected! Product: "${photoQuestionMatch[1] || photoQuestionMatch[2] || photoQuestionMatch[3]}"`);
        } else {
          this.logger.log(`[PHOTO DETECTION] ❌ No photo question pattern matched in last message`);
        }

        const affirmativeWords = [
          'sí',
          'si',
          'yes',
          'ok',
          'dale',
          'claro',
          'por favor',
          'please',
          'oui',
          "d'accord",
          '네',
          '확인',
          'yeah',
          'yep',
          'sure',
        ];
        const isAffirmative = affirmativeWords.some(
          (word) =>
            messageLower === word ||
            messageLower.startsWith(word + ' ') ||
            messageLower.endsWith(' ' + word),
        );

        if (isAffirmative) {
          this.logger.log(`[PHOTO DETECTION] ✅ User message is affirmative: "${message}"`);
        } else {
          this.logger.log(`[PHOTO DETECTION] ❌ User message is NOT affirmative: "${message}"`);
        }

        if (photoQuestionMatch && isAffirmative && branchContext?.menus) {
          const productNameFromQuestion = (
            photoQuestionMatch[1] ||
            photoQuestionMatch[2] ||
            photoQuestionMatch[3] ||
            ''
          ).trim();

          this.logger.log(
            `🔍 Searching for product: "${productNameFromQuestion}" in branch menus`,
          );

          // Buscar el producto en el menú
          let found = false;
          for (const menu of branchContext.menus) {
            if (menu.menuItems) {
              this.logger.log(`[PHOTO DETECTION] Checking menu "${menu.name}" with ${menu.menuItems.length} items`);

              const item = menu.menuItems.find((mi) => {
                const menuProductName = mi.product.name
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '');
                const searchName = productNameFromQuestion
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '');
                return (
                  menuProductName.includes(searchName) ||
                  searchName.includes(menuProductName)
                );
              });

              if (item) {
                this.logger.log(`[PHOTO DETECTION] ✅ Found product "${item.product.name}". Has imageUrl: ${!!item.product.imageUrl}, imageUrl value: "${item.product.imageUrl || 'null'}"`);
                found = true;
              }

              if (item?.product?.imageUrl && item.product.imageUrl.trim()) {
                this.logger.log(
                  `✅ Product has valid photo - Rendering template`,
                );

                const response = await this.templatesService.render({
                  key: 'product.send_photo',
                  language,
                  variables: {
                    imageUrl: item.product.imageUrl,
                    productName: item.product.name,
                  },
                });

                return { shouldUseTemplate: true, response };
              }
            }
          }

          if (!found) {
            this.logger.warn(
              `[PHOTO DETECTION] ❌ Product "${productNameFromQuestion}" NOT found in any menu`,
            );
          } else {
            this.logger.warn(
              `[PHOTO DETECTION] ❌ Product "${productNameFromQuestion}" found but has no valid imageUrl`,
            );
          }
        }
      }

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
        this.logger.log(
          'Detected: Language selection - skipping template, will use OpenAI',
        );
        return { shouldUseTemplate: false };
      }

      // 💡 PRIORITY 1: Detectar pregunta sobre un producto específico
      const productQuestionPatterns = [
        /qué\s+(?:es|son|tiene|contiene)\s+(?:el|la|los|las)\s+([a-záéíóúñ\s]+)/i,
        /qué\s+(?:es|son|tiene|contiene)\s+([a-záéíóúñ\s]+)/i,
        /what\s+(?:is|are|has)\s+(?:the\s+)?([a-z\s]+)/i,
        /tell\s+me\s+about\s+(?:the\s+)?([a-z\s]+)/i,
        /qu'est-ce\s+que\s+(?:le|la|les)\s+([a-zàâäéèêëïîôùûüÿç\s]+)/i,
      ];

      for (const pattern of productQuestionPatterns) {
        const match = message.match(pattern);
        if (match && branchContext?.menus) {
          const potentialProductName = match[1].trim();

          this.logger.log(
            `[PRODUCT QUESTION] Detected product question: "${potentialProductName}"`,
          );

          // Buscar el producto en el menú (normalizado)
          for (const menu of branchContext.menus) {
            if (!menu.menuItems) continue;

            const item = menu.menuItems.find((mi) => {
              const menuProductName = mi.product.name
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
              const searchName = potentialProductName
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');

              return (
                menuProductName.includes(searchName) ||
                searchName.includes(menuProductName)
              );
            });

            if (item?.product) {
              const productName = item.product.name;
              const description =
                item.product.description || 'un delicioso platillo';
              const hasPhoto =
                item.product.imageUrl && item.product.imageUrl.trim();

              this.logger.log(
                `[PRODUCT QUESTION] ✅ Found product "${productName}", has photo: ${!!hasPhoto}`,
              );

              // Usar template apropiada según si tiene foto o no
              const templateKey = hasPhoto
                ? 'product.ask_with_photo'
                : 'product.ask_without_photo';

              this.logger.log(
                `[PRODUCT QUESTION] Using template: ${templateKey}`,
              );

              const response = await this.templatesService.render({
                key: templateKey,
                language,
                variables: {
                  productName,
                  description: description.toLowerCase(),
                },
              });

              return { shouldUseTemplate: true, response };
            }
          }

          this.logger.log(
            `[PRODUCT QUESTION] ❌ Product "${potentialProductName}" not found in menus`,
          );
          // No encontrado - dejar que OpenAI maneje
          break;
        }
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
