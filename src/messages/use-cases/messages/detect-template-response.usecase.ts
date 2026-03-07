import { Injectable, Logger } from '@nestjs/common';
import { TemplatesService } from '../../../templates/templates.service';
import { Customer } from '../../../customers/entities/customer.entity';
import { Branch } from '../../../branches/entities/branch.entity';

export interface TemplateDetectionResult {
  shouldUseTemplate: boolean;
  response?: string;
  addedProduct?: {
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
    notes?: string;
  };
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

        // PRIORITY 0B: Detectar respuesta NEGATIVA a ofertas del bot
        const negativeWords = ['no', 'nope', 'non', 'nada', 'nothing', 'rien', '아니오', 'no gracias', 'no thanks'];
        const isNegative = negativeWords.some(
          (word) =>
            messageLower === word ||
            messageLower.startsWith(word + ' ') ||
            messageLower.endsWith(' ' + word) ||
            messageLower.includes(' ' + word + ' '),
        );

        if (isNegative && lastBotMessage.content.match(/\?/)) {
          // El bot hizo una pregunta y el usuario dijo no
          this.logger.log('Detected: Negative response to bot question');

          // CHECK CRITICAL: Si el bot preguntó "¿Deseas agregar algo más?" y el usuario dijo "No",
          // NO usar plantilla - pasar al flujo de detección de orden para enviar notificación a caja
          const addMorePattern = /¿deseas\s+agregar\s+algo\s+más|would\s+you\s+like\s+to\s+add\s+something\s+else|souhaitez-vous\s+ajouter\s+autre\s+chose|다른\s+것을\s+추가하시겠습니까/i;
          if (lastBotMessage.content.match(addMorePattern)) {
            this.logger.log('⚠️ User declined "add more?" - passing to AI for order confirmation and cashier notification');
            return { shouldUseTemplate: false }; // Let AI handle order confirmation
          }

          // Verificar si rechazó ver foto o agregar producto específico
          const photoQuestionMatch = lastBotMessage.content.match(photoQuestionPattern);
          const addProductMatch = lastBotMessage.content.match(/¿deseas\s+agregar\s+(?:los?\s+|las?\s+)?\*([^*]+)\*|would\s+you\s+like\s+to\s+add\s+(?:the\s+)?\*([^*]+)\*|souhaitez-vous\s+ajouter\s+(?:le\s+|la\s+|les\s+)?\*([^*]+)\*/i);

          if (photoQuestionMatch || addProductMatch) {
            const response = await this.templatesService.render({
              key: 'conversation.continue_browsing',
              language,
              variables: {},
            });
            return { shouldUseTemplate: true, response };
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
        /qu[eé]\s+(?:es|son|tiene|contiene|hay\s+en)\s+(?:el|la|los|las)\s+([a-záéíóúñ\s]+)/i,
        /qu[eé]\s+(?:es|son|tiene|contiene)\s+([a-záéíóúñ\s]+)/i,
        /cu[aá]les?\s+son\s+(?:los?\s+)?([a-záéíóúñ\s]+)/i,
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

              // Validación estricta: imageUrl debe existir, no estar vacío y tener contenido real
              const imageUrl = item.product.imageUrl;
              const hasPhoto = !!(imageUrl && imageUrl.trim().length > 0);

              this.logger.log(
                `[PRODUCT QUESTION] ✅ Found product "${productName}"`,
              );
              this.logger.log(
                `[PRODUCT QUESTION] - imageUrl value: "${imageUrl || 'null/undefined'}"`,
              );
              this.logger.log(
                `[PRODUCT QUESTION] - hasPhoto: ${hasPhoto}`,
              );

              // Usar template apropiada según si tiene foto o no
              const templateKey = hasPhoto
                ? 'product.ask_with_photo'
                : 'product.ask_without_photo';

              this.logger.log(
                `[PRODUCT QUESTION] → Using template: ${templateKey}`,
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

      // 🛒 PRIORITY 2A: Detectar confirmación de agregar producto después de pregunta del bot
      const lastBotMessageForProduct =
        conversationHistory.length > 0
          ? conversationHistory[conversationHistory.length - 1]
          : null;

      if (lastBotMessageForProduct && lastBotMessageForProduct.role === 'assistant') {
        // Detectar pregunta "¿Deseas agregar X a tu pedido?"
        const addProductQuestionPattern = /¿deseas\s+agregar\s+(?:los?\s+|las?\s+)?\*([^*]+)\*\s+a\s+tu\s+pedido\?|would\s+you\s+like\s+to\s+add\s+(?:the\s+)?\*([^*]+)\*\s+to\s+your\s+order\?|souhaitez-vous\s+ajouter\s+(?:le\s+|la\s+|les\s+)?\*([^*]+)\*\s+à\s+votre\s+commande\?/i;
        const addProductMatch = lastBotMessageForProduct.content.match(addProductQuestionPattern);

        if (addProductMatch) {
          const productNameFromQuestion = (
            addProductMatch[1] ||
            addProductMatch[2] ||
            addProductMatch[3] ||
            ''
          ).trim();

          this.logger.log(`[PRODUCT CONFIRMATION] Bot asked about adding: "${productNameFromQuestion}"`);

          // Verificar si es respuesta afirmativa
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

          if (isAffirmative && branchContext?.menus) {
            this.logger.log(`[PRODUCT CONFIRMATION] User confirmed with: "${message}"`);

            // Buscar el producto en el menú
            let foundProduct: any = null;
            let foundMenuItem: any = null;

            for (const menu of branchContext.menus) {
              if (!menu.menuItems) continue;

              for (const menuItem of menu.menuItems) {
                if (!menuItem.isActive || !menuItem.product) continue;

                const normalizedQuestion = productNameFromQuestion
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .trim();

                const normalizedProduct = menuItem.product.normalizedName
                  ?.toLowerCase() || menuItem.product.name
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .trim();

                if (
                  normalizedProduct.includes(normalizedQuestion) ||
                  normalizedQuestion.includes(normalizedProduct)
                ) {
                  foundProduct = menuItem.product;
                  foundMenuItem = menuItem;
                  this.logger.log(`[PRODUCT CONFIRMATION] ✅ Found product: "${foundProduct.name}"`);
                  break;
                }
              }

              if (foundProduct) break;
            }

            if (foundProduct && foundMenuItem) {
              // Construir el producto agregado
              const price = parseFloat(foundMenuItem.price.toString());
              const quantity = 1;
              const subtotal = price * quantity;
              const categoryName = foundMenuItem.category?.name || 'Sin categoría';

              const addedProduct = {
                menuItemId: foundMenuItem.id,
                name: foundProduct.name,
                category: categoryName,
                price: price.toFixed(2),
                quantity,
                subtotal: subtotal.toFixed(2),
              };

              // Construir el pedido completo acumulado
              const completeOrder: any[] = [];

              // NUEVA LÓGICA: Leer productos del último mensaje del asistente que contenga productos
              // (en lugar de lastOrderSentToCashier que solo se actualiza al enviar a caja)
              let productsFromLastMessage: Record<string, any> = {};
              
              // Buscar hacia atrás en el historial el último mensaje del asistente con productos
              for (let i = conversationHistory.length - 1; i >= 0; i--) {
                const msg = conversationHistory[i];
                if (msg.role === 'assistant') {
                  const contentLower = msg.content.toLowerCase();
                  
                  // Verificar si tiene productos con formato [ID:xxx]
                  const hasProducts = msg.content.includes('• ') && msg.content.match(/\[ID:[^\]]+\]/);
                  
                  // Verificar si tiene sección de pedido completo
                  const hasCompleteOrderSection =
                    contentLower.includes('tu pedido completo:') ||
                    contentLower.includes('pedido actualizado:') ||
                    contentLower.includes('your complete order:') ||
                    contentLower.includes('updated order:') ||
                    contentLower.includes('votre commande complète:') ||
                    contentLower.includes('commande mise à jour:');
                  
                  if (hasProducts && (hasCompleteOrderSection || contentLower.includes('he agregado') || contentLower.includes('i added'))) {
                    this.logger.log(`[BUILD ORDER] Found last message with products at index ${i}`);
                    
                    // Extraer productos usando regex similar al extractOrderFromResponseUtil
                    const productLines = msg.content.match(/•\s*\[ID:([^\]]+)\]\s*([^(\n:]+)(?:\s*\([^)]+\))?\s*:\s*\$?(\d+(?:\.\d{2})?)\s*x?\s*(\d+)\s*=\s*\$?(\d+(?:\.\d{2})?)/g);
                    
                    if (productLines) {
                      for (const line of productLines) {
                        const match = line.match(/•\s*\[ID:([^\]]+)\]\s*([^(\n:]+)(?:\s*\([^)]+\))?\s*:\s*\$?(\d+(?:\.\d{2})?)\s*x?\s*(\d+)\s*=\s*\$?(\d+(?:\.\d{2})?)/);
                        if (match) {
                          const [, menuItemId, productName, priceStr, quantityStr,subtotalStr] = match;
                          const cleanName = productName.trim();
                          
                          // Buscar notas en la misma línea
                          const noteMatch = line.match(/\[Nota:\s*([^\]]+)\]|\[Note:\s*([^\]]+)\]/i);
                          const notes = noteMatch ? (noteMatch[1] || noteMatch[2]).trim() : undefined;
                          
                          productsFromLastMessage[cleanName] = {
                            menuItemId: menuItemId.trim(),
                            price: parseFloat(priceStr),
                            quantity: parseInt(quantityStr),
                            notes,
                          };
                        }
                      }
                      this.logger.log(`[BUILD ORDER] Extracted ${Object.keys(productsFromLastMessage).length} products from last message`);
                      break;
                    }
                  }
                }
              }

              // Agregar productos del último mensaje
              if (Object.keys(productsFromLastMessage).length > 0) {
                for (const [productName, orderItem] of Object.entries(productsFromLastMessage)) {
                  // Buscar detalles del producto en los menús
                  let itemDetails: any = null;
                  for (const menu of branchContext.menus) {
                    if (!menu.menuItems) continue;
                    const item = menu.menuItems.find(mi => mi.id === orderItem.menuItemId);
                    if (item) {
                      itemDetails = item;
                      break;
                    }
                  }

                  if (itemDetails) {
                    completeOrder.push({
                      menuItemId: orderItem.menuItemId,
                      name: itemDetails.product.name,
                      category: itemDetails.category?.name || 'Sin categoría',
                      price: parseFloat(orderItem.price.toString()).toFixed(2),
                      quantity: orderItem.quantity,
                      subtotal: (orderItem.price * orderItem.quantity).toFixed(2),
                      ...(orderItem.notes ? { notes: orderItem.notes } : {}),
                    });
                  }
                }
              }

              // Agregar el nuevo producto (o actualizar cantidad si ya existe)
              const existingIndex = completeOrder.findIndex(item => item.menuItemId === addedProduct.menuItemId);
              if (existingIndex >= 0) {
                // Si ya existe, actualizar cantidad
                completeOrder[existingIndex].quantity += addedProduct.quantity;
                completeOrder[existingIndex].subtotal = (
                  parseFloat(completeOrder[existingIndex].price) * completeOrder[existingIndex].quantity
                ).toFixed(2);
              } else {
                // Si no existe, agregar nuevo
                completeOrder.push(addedProduct);
              }

              this.logger.log(`[PRODUCT CONFIRMATION] Complete order has ${completeOrder.length} items`);

              // Renderizar template
              const response = await this.templatesService.render({
                key: 'order.item_added',
                language,
                variables: {
                  addedProduct,
                  completeOrder,
                },
              });

              return {
                shouldUseTemplate: true,
                response,
                addedProduct: {
                  menuItemId: foundMenuItem.id,
                  name: foundProduct.name,
                  price,
                  quantity,
                },
              };
            } else {
              this.logger.warn(`[PRODUCT CONFIRMATION] ❌ Product "${productNameFromQuestion}" not found in menu`);
            }
          }
        }
      }

      // 🛒 PRIORITY 2B: Detectar solicitud de producto (agregar al pedido)
      const productRequestPatterns = [
        /(?:dame|deme|agrég|añad|quiero|queremos|me\s+das?|tráeme|traeme|necesito|pido|pídeme|pideme|también|tambien|otro|otra)\s+(?:un\s+|una\s+|el\s+|la\s+|los\s+|las\s+)?([a-záéíóúñ\s]+?)(?:\s+sin\s+|\s+con\s+|$)/i,
        /(?:add|give\s+me|i\s+want|i\s+need|i'd\s+like|bring\s+me|another|also)\s+(?:a\s+|an\s+|the\s+|some\s+)?([a-z\s]+?)(?:\s+without|\s+with|$)/i,
        /(?:ajoutez|donnez-moi|je\s+veux|j'aimerais|apportez-moi|aussi|un\s+autre)\s+(?:un\s+|une\s+|le\s+|la\s+|les\s+|des\s+)?([a-záéíóúñ\s]+?)(?:\s+sans|\s+avec|$)/i,
      ];

      for (const pattern of productRequestPatterns) {
        const match = message.match(pattern);
        if (match && branchContext?.menus) {
          const productNameRequested = match[1].trim();
          this.logger.log(`[PRODUCT REQUEST] Detected product request: "${productNameRequested}"`);

          // Extraer notas especiales (sin, con, without, with, sans, avec)
          const notesMatch = message.match(/(sin|without|sans)\s+([a-záéíóúñ\s]+)|(con|with|avec)\s+([a-záéíóúñ\s]+)/i);
          let notes: string | undefined = undefined;
          if (notesMatch) {
            // Capturar el prefijo (sin/con/without/etc) + el complemento
            const prefix = notesMatch[1] || notesMatch[3];  // sin/con/without/with/sans/avec
            const complement = (notesMatch[2] || notesMatch[4])?.trim();
            notes = `${prefix} ${complement}`;
            this.logger.log(`[PRODUCT REQUEST] Special notes detected: "${notes}"`);
          }

          // Buscar el producto en el menú (normalizado)
          let foundProduct: any = null;
          let foundMenuItem: any = null;

          for (const menu of branchContext.menus) {
            if (!menu.menuItems) continue;

            for (const menuItem of menu.menuItems) {
              if (!menuItem.isActive || !menuItem.product) continue;

              const normalizedRequest = productNameRequested
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim();

              const normalizedProduct = menuItem.product.normalizedName
                ?.toLowerCase() || menuItem.product.name
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .trim();

              if (
                normalizedProduct.includes(normalizedRequest) ||
                normalizedRequest.includes(normalizedProduct)
              ) {
                foundProduct = menuItem.product;
                foundMenuItem = menuItem;
                this.logger.log(`[PRODUCT REQUEST] ✅ Found product: "${foundProduct.name}"`);
                break;
              }
            }

            if (foundProduct) break;
          }

          if (!foundProduct || !foundMenuItem) {
            this.logger.log(`[PRODUCT REQUEST] ❌ Product "${productNameRequested}" not found in menu`);
            break; // Dejar que OpenAI maneje
          }

          // Construir el producto agregado
          const price = parseFloat(foundMenuItem.price.toString());
          const quantity = 1;
          const subtotal = price * quantity;
          const categoryName = foundMenuItem.category?.name || 'Sin categoría';

          const addedProduct = {
            menuItemId: foundMenuItem.id,
            name: foundProduct.name,
            category: categoryName,
            price: price.toFixed(2),
            quantity,
            subtotal: subtotal.toFixed(2),
            ...(notes ? { notes } : {}),
          };

          // Construir el pedido completo acumulado
          const completeOrder: any[] = [];

          // NUEVA LÓGICA: Leer productos del último mensaje del asistente que contenga productos
          let productsFromLastMessage: Record<string, any> = {};
          
          // Buscar hacia atrás en el historial el último mensaje del asistente con productos
          for (let i = conversationHistory.length - 1; i >= 0; i--) {
            const msg = conversationHistory[i];
            if (msg.role === 'assistant') {
              const contentLower = msg.content.toLowerCase();
              
              // Verificar si tiene productos con formato [ID:xxx]
              const hasProducts = msg.content.includes('• ') && msg.content.match(/\[ID:[^\]]+\]/);
              
              // Verificar si tiene sección de pedido completo
              const hasCompleteOrderSection =
                contentLower.includes('tu pedido completo:') ||
                contentLower.includes('pedido actualizado:') ||
                contentLower.includes('your complete order:') ||
                contentLower.includes('updated order:') ||
                contentLower.includes('votre commande complète:') ||
                contentLower.includes('commande mise à jour:');
              
              if (hasProducts && (hasCompleteOrderSection || contentLower.includes('he agregado') || contentLower.includes('i added'))) {
                this.logger.log(`[BUILD ORDER] Found last message with products at index ${i}`);
                
                // Extraer productos usando regex
                const productLines = msg.content.match(/•\s*\[ID:([^\]]+)\]\s*([^(\n:]+)(?:\s*\([^)]+\))?\s*:\s*\$?(\d+(?:\.\d{2})?)\s*x?\s*(\d+)\s*=\s*\$?(\d+(?:\.\d{2})?)/g);
                
                if (productLines) {
                  for (const line of productLines) {
                    const match = line.match(/•\s*\[ID:([^\]]+)\]\s*([^(\n:]+)(?:\s*\([^)]+\))?\s*:\s*\$?(\d+(?:\.\d{2})?)\s*x?\s*(\d+)\s*=\s*\$?(\d+(?:\.\d{2})?)/);
                    if (match) {
                      const [, menuItemId, productName, priceStr, quantityStr] = match;
                      const cleanName = productName.trim();
                      
                      // Buscar notas en la misma línea
                      const noteMatch = line.match(/\[Nota:\s*([^\]]+)\]|\[Note:\s*([^\]]+)\]/i);
                      const productNotes = noteMatch ? (noteMatch[1] || noteMatch[2]).trim() : undefined;
                      
                      productsFromLastMessage[cleanName] = {
                        menuItemId: menuItemId.trim(),
                        price: parseFloat(priceStr),
                        quantity: parseInt(quantityStr),
                        notes: productNotes,
                      };
                    }
                  }
                  this.logger.log(`[BUILD ORDER] Extracted ${Object.keys(productsFromLastMessage).length} products from last message`);
                  break;
                }
              }
            }
          }

          // Agregar productos del último mensaje
          if (Object.keys(productsFromLastMessage).length > 0) {
            for (const [productName, orderItem] of Object.entries(productsFromLastMessage)) {
              // Buscar detalles del producto en los menús
              let itemDetails: any = null;
              for (const menu of branchContext.menus) {
                if (!menu.menuItems) continue;
                const item = menu.menuItems.find(mi => mi.id === orderItem.menuItemId);
                if (item) {
                  itemDetails = item;
                  break;
                }
              }

              if (itemDetails) {
                completeOrder.push({
                  menuItemId: orderItem.menuItemId,
                  name: itemDetails.product.name,
                  category: itemDetails.category?.name || 'Sin categoría',
                  price: parseFloat(orderItem.price.toString()).toFixed(2),
                  quantity: orderItem.quantity,
                  subtotal: (orderItem.price * orderItem.quantity).toFixed(2),
                  ...(orderItem.notes ? { notes: orderItem.notes } : {}),
                });
              }
            }
          }

          // Agregar el nuevo producto (o actualizar cantidad si ya existe)
          const existingIndex = completeOrder.findIndex(item => item.menuItemId === addedProduct.menuItemId && item.notes === addedProduct.notes);
          if (existingIndex >= 0) {
            // Si ya existe con las mismas notas, actualizar cantidad
            completeOrder[existingIndex].quantity += addedProduct.quantity;
            completeOrder[existingIndex].subtotal = (
              parseFloat(completeOrder[existingIndex].price) * completeOrder[existingIndex].quantity
            ).toFixed(2);
          } else {
            // Si no existe o tiene notas diferentes, agregar nuevo
            completeOrder.push(addedProduct);
          }

          this.logger.log(`[PRODUCT REQUEST] Complete order has ${completeOrder.length} items`);

          // Renderizar template apropiado
          const templateKey = notes ? 'order.item_added_with_note' : 'order.item_added';

          const response = await this.templatesService.render({
            key: templateKey,
            language,
            variables: {
              addedProduct,
              completeOrder,
            },
          });

          return {
            shouldUseTemplate: true,
            response,
            addedProduct: {
              menuItemId: foundMenuItem.id,
              name: foundProduct.name,
              price,
              quantity,
              ...(notes ? { notes } : {}),
            },
          };
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

      // 6. Ver pedido actual
      if (
        messageLower.includes('mi pedido') ||
        messageLower.includes('qué pedí') ||
        messageLower.includes('qué llevo') ||
        messageLower.includes('my order') ||
        messageLower.includes('what did i order') ||
        messageLower.includes('ver mi pedido') ||
        messageLower.includes('ver pedido') ||
        messageLower.includes('show my order') ||
        messageLower.includes('view order')
      ) {
        // 6A. Carrito vacío
        if (!lastOrderSentToCashier || Object.keys(lastOrderSentToCashier).length === 0) {
          this.logger.log('Detected: Empty cart');
          const response = await this.templatesService.render({
            key: 'order.empty_cart',
            language,
            variables: {},
          });
          return { shouldUseTemplate: true, response };
        }

        // 6B. Ver pedido actual con productos
        if (branchContext?.menus) {
          this.logger.log('Detected: View current order');

          const items: any[] = [];
          let total = 0;

          for (const orderItem of Object.values(lastOrderSentToCashier)) {
            let itemDetails: any = null;
            for (const menu of branchContext.menus) {
              if (!menu.menuItems) continue;
              const item = menu.menuItems.find(mi => mi.id === orderItem.menuItemId);
              if (item) {
                itemDetails = item;
                break;
              }
            }

            if (itemDetails) {
              const itemPrice = parseFloat(orderItem.price.toString());
              const itemSubtotal = itemPrice * orderItem.quantity;
              total += itemSubtotal;

              items.push({
                menuItemId: orderItem.menuItemId,
                name: itemDetails.product.name,
                category: itemDetails.category?.name || 'Sin categoría',
                price: itemPrice.toFixed(2),
                quantity: orderItem.quantity,
                subtotal: itemSubtotal.toFixed(2),
                ...(orderItem.notes ? { notes: orderItem.notes } : {}),
              });
            }
          }

          const response = await this.templatesService.render({
            key: 'order.view_current',
            language,
            variables: {
              items,
              total: total.toFixed(2),
            },
          });

          return { shouldUseTemplate: true, response };
        }
      }

      // 7. Confirmar pedido (usuario responde "No" a ¿Deseas agregar algo más?)
      if (lastBotMessageForProduct && lastBotMessageForProduct.role === 'assistant') {
        const addMoreQuestionPattern = /¿deseas\s+agregar\s+algo\s+más\?|would\s+you\s+like\s+to\s+add\s+something\s+else\?|souhaitez-vous\s+ajouter\s+autre\s+chose\?/i;
        const addMoreMatch = lastBotMessageForProduct.content.match(addMoreQuestionPattern);

        if (addMoreMatch) {
          const negativeWords = ['no', 'nope', 'non', 'nada', 'nothing', 'rien', '아니오'];
          const isNegative = negativeWords.some(
            (word) =>
              messageLower === word ||
              messageLower.startsWith(word + ' ') ||
              messageLower.endsWith(' ' + word) ||
              messageLower.includes(' ' + word + ' '),
          );

          if (isNegative && lastOrderSentToCashier && Object.keys(lastOrderSentToCashier).length > 0 && branchContext?.menus) {
            this.logger.log('Detected: Order confirmation (user declined to add more)');

            // Construir items del pedido para confirmación
            const items: any[] = [];
            let total = 0;

            for (const orderItem of Object.values(lastOrderSentToCashier)) {
              let itemDetails: any = null;
              for (const menu of branchContext.menus) {
                if (!menu.menuItems) continue;
                const item = menu.menuItems.find(mi => mi.id === orderItem.menuItemId);
                if (item) {
                  itemDetails = item;
                  break;
                }
              }

              if (itemDetails) {
                const itemPrice = parseFloat(orderItem.price.toString());
                const itemSubtotal = itemPrice * orderItem.quantity;
                total += itemSubtotal;

                items.push({
                  name: itemDetails.product.name,
                  quantity: orderItem.quantity,
                  price: itemSubtotal.toFixed(2),
                  ...(orderItem.notes ? { notes: orderItem.notes } : {}),
                });
              }
            }

            const response = await this.templatesService.render({
              key: 'order.confirmation',
              language,
              variables: {
                orderNumber: new Date().getTime().toString().slice(-6),
                items,
                total: total.toFixed(2),
                estimatedTime: '15-20',
              },
            });

            return { shouldUseTemplate: true, response };
          }
        }
      }

      // 8. Solicitar la cuenta/bill
      if (
        messageLower.includes('cuenta') ||
        messageLower.includes('bill') ||
        messageLower.includes('check') ||
        messageLower.includes('la cuenta') ||
        messageLower.includes('mi cuenta') ||
        messageLower.includes('the bill') ||
        messageLower.includes('the check') ||
        messageLower.includes('l\'addition') ||
        messageLower.includes('addition')
      ) {
        if (lastOrderSentToCashier && Object.keys(lastOrderSentToCashier).length > 0 && branchContext?.menus) {
          this.logger.log('Detected: Bill request');

          // Construir items del pedido para la cuenta
          const items: any[] = [];
          let total = 0;

          for (const orderItem of Object.values(lastOrderSentToCashier)) {
            let itemDetails: any = null;
            for (const menu of branchContext.menus) {
              if (!menu.menuItems) continue;
              const item = menu.menuItems.find(mi => mi.id === orderItem.menuItemId);
              if (item) {
                itemDetails = item;
                break;
              }
            }

            if (itemDetails) {
              const unitPrice = parseFloat(orderItem.price.toString());
              const subtotal = unitPrice * orderItem.quantity;
              total += subtotal;

              items.push({
                name: itemDetails.product.name,
                quantity: orderItem.quantity,
                unitPrice: unitPrice.toFixed(2),
                subtotal: subtotal.toFixed(2),
              });
            }
          }

          const response = await this.templatesService.render({
            key: 'order.request_bill',
            language,
            variables: {
              items,
              total: total.toFixed(2),
            },
          });

          return { shouldUseTemplate: true, response };
        }
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
