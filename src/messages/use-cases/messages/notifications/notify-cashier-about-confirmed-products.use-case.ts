import { NotifyCashier } from '../../../interfaces/messages.interfaces';
import { calculateOrderChangesUtil } from '../../../utils/calculate-order-changes.util';
import { extractAmenitiesFromResponseUtil } from '../../../utils/extract-amenities-from-response.util';
import { extractOrderFromResponseUtil } from '../../../utils/extract-order-from-response.util';
import { extractTableInfoFromConversationUtil } from '../../../utils/extract-table-information-from-conversation.util';
import { generateCashierMessageUseCase } from '../generate-cashier-message.use-case';
import { sendMessageUseCase } from '../send-message.use-case';

export const notifyCashierAboutConfirmedProductsUseCase = async (
  params: NotifyCashier,
): Promise<void> => {
  const {
    from,
    customer,
    branch,
    twilioService,
    conversationService,
    menuService,
    logger,
  } = params;

  try {
    const conversation = await conversationService.getOrCreateConversation(
      from,
      branch.id,
    );

    const { messages } = await conversationService.getConversationHistory(
      conversation.conversationId,
    );

    logger.log(
      `\n=== FULL CONVERSATION HISTORY (${messages.length} messages) ===`,
    );
    messages.forEach((msg, idx) => {
      logger.log(`\nMessage ${idx} [${msg.role}]:`);
      logger.log(`  ${msg.content.substring(0, 150)}...`);
    });
    logger.log(`=== END CONVERSATION HISTORY ===\n`);

    // Encontrar el índice de la última confirmación previa (si existe)
    // NO incluir la confirmación más reciente (que es la que activó esta notificación)
    let lastConfirmationIndex = -1;
    let confirmationCount = 0;

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      if (message.role === 'assistant') {
        const contentLower = message.content.toLowerCase();

        const isConfirmation =
          contentLower.includes(
            'perfecto, gracias por confirmar, tu pedido está ahora en proceso',
          ) ||
          contentLower.includes(
            'perfect, thank you for confirming, your order is now being processed',
          ) ||
          contentLower.includes(
            'parfait, merci de confirmer, votre commande est maintenant en cours de traitement',
          ) ||
          contentLower.includes(
            '완벽합니다. 확인해 주셔서 감사합니다. 주문이 이제 처리 중입니다',
          );

        if (isConfirmation) {
          confirmationCount++;
          // Solo guardar si NO es la última confirmación
          if (i < messages.length - 1) {
            lastConfirmationIndex = i;
            logger.log(`Found previous confirmation at index ${i}`);
          } else {
            logger.log(`Found current confirmation at index ${i} (skipping)`);
          }
        }
      }
    }

    logger.log(
      `Last PREVIOUS confirmation index: ${lastConfirmationIndex}, total messages: ${messages.length}, total confirmations: ${confirmationCount}`,
    );

    // Buscar el mensaje de productos completo inmediatamente ANTERIOR a la confirmación actual
    // Este mensaje DEBE contener el pedido COMPLETO acumulado (según instrucciones del prompt)
    // La confirmación actual está en el último mensaje (messages.length - 1)
    let productMessage: string | null = null;

    logger.log(`=== SEARCHING FOR COMPLETE ORDER MESSAGE ===`);
    logger.log(`Total messages: ${messages.length}`);
    logger.log(`Starting search from message ${messages.length - 2} backwards`);

    // Buscar hacia atrás desde el penúltimo mensaje hasta encontrar el mensaje con el pedido completo
    for (let i = messages.length - 2; i >= 0; i--) {
      const message = messages[i];
      if (message.role === 'assistant') {
        const contentLower = message.content.toLowerCase();

        logger.log(`\n--- Checking message ${i} (assistant) ---`);
        logger.log(`First 200 chars: ${message.content.substring(0, 200)}...`);

        const isRecommendation =
          contentLower.includes('puedo sugerir') ||
          contentLower.includes('i recommend') ||
          contentLower.includes('je recommande') ||
          contentLower.includes('추천합니다') ||
          contentLower.includes('te recomiendo') ||
          contentLower.includes('with pleasure') ||
          contentLower.includes('avec plaisir') ||
          contentLower.includes('기꺼이') ||
          contentLower.includes('⭐ recomendado') ||
          contentLower.includes('¡con gusto!');

        // No incluir mensajes de confirmación previas
        const isConfirmation =
          contentLower.includes('perfecto, gracias por confirmar') ||
          contentLower.includes('perfect, thank you for confirming') ||
          contentLower.includes('parfait, merci de confirmer') ||
          contentLower.includes('완벽합니다. 확인해 주셔서 감사합니다');

        const hasProducts =
          message.content.includes('• ') &&
          message.content.match(/\[ID:[^\]]+\]/);

        // Buscar específicamente la sección "pedido completo" o "complete order"
        const hasCompleteOrderSection =
          contentLower.includes('tu pedido completo:') ||
          contentLower.includes('pedido actual:') ||
          contentLower.includes('your complete order:') ||
          contentLower.includes('current order:') ||
          contentLower.includes('votre commande complète:') ||
          contentLower.includes('commande actuelle:') ||
          contentLower.includes('전체 주문:') ||
          contentLower.includes('현재 주문:');

        // También aceptar mensajes con formato de productos agregados
        const hasAddedKeyword =
          contentLower.includes('he agregado') ||
          contentLower.includes('he actualizado') ||
          contentLower.includes('i added') ||
          contentLower.includes('i updated') ||
          contentLower.includes("j'ai ajouté") ||
          contentLower.includes("j'ai mis à jour") ||
          contentLower.includes('추가했습니다') ||
          contentLower.includes('업데이트했습니다');

        // Verificar que el producto tenga formato completo con cantidad (x N)
        const hasQuantityFormat = message.content.match(
          /\$\d+\.\d{2}\s*x\s*\d+/,
        );

        // Detectar si es un mensaje con cuentas separadas (múltiples secciones de personas)
        const hasSeparateAccounts =
          (message.content.match(/\*\*[A-Za-zÁ-ú\s]+:\*\*/g) || []).length >= 2;

        // Para ser válido, debe tener productos Y (sección completa O (keyword de agregado O formato con cantidad))
        const isValidProductMessage =
          hasProducts &&
          (hasCompleteOrderSection || hasAddedKeyword || !!hasQuantityFormat);

        logger.log(
          `Checking message ${i}: isRecommendation=${isRecommendation}, isConfirmation=${isConfirmation}, hasProducts=${!!hasProducts}, hasCompleteOrderSection=${hasCompleteOrderSection}, hasAddedKeyword=${hasAddedKeyword}, hasQuantityFormat=${!!hasQuantityFormat}, hasSeparateAccounts=${hasSeparateAccounts}, isValid=${isValidProductMessage}`,
        );

        if (!isRecommendation && !isConfirmation && isValidProductMessage) {
          // Si ya tenemos un mensaje candidato pero este tiene cuentas separadas, reemplazarlo
          const shouldReplace =
            !productMessage ||
            (hasSeparateAccounts &&
              !productMessage.match(/\*\*[A-Za-zÁ-ú\s]+:\*\*/g));

          if (shouldReplace || hasSeparateAccounts) {
            productMessage = message.content;
            logger.log(
              `✅ FOUND ${hasSeparateAccounts ? 'SEPARATE ACCOUNTS' : 'COMPLETE'} ORDER MESSAGE at index ${i}!`,
            );
            logger.log(
              `=== FULL PRODUCT MESSAGE ===\n${productMessage.substring(0, 500)}...\n=== END ===`,
            );

            // Si tiene cuentas separadas, este es el mensaje definitivo
            if (hasSeparateAccounts) {
              break;
            }
          }
        }
      }
    }

    logger.log(`=== END SEARCH ===\n`);

    logger.log(`Complete order message found: ${productMessage !== null}`);

    // NUEVA LÓGICA ROBUSTA: Si no encontramos un mensaje con "pedido completo",
    // acumular productos de TODOS los mensajes "He agregado" desde la última confirmación
    let currentOrder: Record<
      string,
      { price: number; quantity: number; menuItemId: string; notes?: string }
    > = {};

    if (productMessage) {
      // Caso ideal: encontramos el mensaje con pedido completo
      logger.log(
        `=== PRODUCT MESSAGE CONTENT ===\n${productMessage}\n=== END PRODUCT MESSAGE ===`,
      );
      currentOrder = extractOrderFromResponseUtil(productMessage, logger);
    } else {
      // Caso fallback: acumular productos de todos los mensajes "He agregado"
      logger.warn(
        'No complete order message found, accumulating products from all "added" messages since last confirmation',
      );

      const startIndex =
        lastConfirmationIndex >= 0 ? lastConfirmationIndex + 1 : 0;

      logger.log(
        `\n=== ACCUMULATING PRODUCTS FROM MESSAGES ${startIndex} to ${messages.length - 1} ===`,
      );

      for (let i = startIndex; i < messages.length; i++) {
        const message = messages[i];
        if (message.role === 'assistant') {
          const contentLower = message.content.toLowerCase();

          // Buscar mensajes con "He agregado" o equivalentes
          const hasAddedKeyword =
            contentLower.includes('he agregado') ||
            contentLower.includes('he actualizado') ||
            contentLower.includes('i added') ||
            contentLower.includes('i updated') ||
            contentLower.includes("j'ai ajouté") ||
            contentLower.includes("j'ai mis à jour") ||
            contentLower.includes('추가했습니다') ||
            contentLower.includes('업데이트했습니다');

          // Y que tenga productos con formato [ID:xxx]
          const hasProducts =
            message.content.includes('• ') &&
            message.content.match(/\[ID:[^\]]+\]/);

          if (hasAddedKeyword && hasProducts) {
            logger.log(`\n  ✅ Found "added" message at index ${i}`);
            logger.log(
              `  First 200 chars: ${message.content.substring(0, 200)}...`,
            );

            // Extraer productos de este mensaje
            const productsInMessage = extractOrderFromResponseUtil(
              message.content,
              logger,
            );

            // Acumular productos (si un producto ya existe, REEMPLAZAR con la cantidad más reciente)
            // Esto mantiene el comportamiento correcto: la última interacción tiene prioridad
            Object.assign(currentOrder, productsInMessage);

            logger.log(
              `  Products extracted: ${Object.keys(productsInMessage).length}`,
            );
          }
        }
      }

      logger.log(`\n=== ACCUMULATED ORDER ===`);
      logger.log(JSON.stringify(currentOrder, null, 2));
      logger.log(`=== END ACCUMULATED ORDER ===\n`);

      if (Object.keys(currentOrder).length === 0) {
        logger.warn(
          'No products found in accumulated messages, cannot notify cashier',
        );
        return;
      }
    }

    logger.log(
      `=== EXTRACTED CURRENT ORDER ===\n${JSON.stringify(currentOrder, null, 2)}\n=== END CURRENT ORDER ===`,
    );

    // Extraer amenidades de todos los mensajes recientes del AI
    const amenities: Record<string, number> = {};
    for (
      let i = messages.length - 1;
      i >= 0 && i >= lastConfirmationIndex;
      i--
    ) {
      const message = messages[i];
      if (message.role === 'assistant') {
        const extractedAmenities = extractAmenitiesFromResponseUtil(
          message.content,
          logger,
        );
        // Acumular amenidades (sumar cantidades si se repiten)
        for (const [amenity, quantity] of Object.entries(extractedAmenities)) {
          amenities[amenity] = (amenities[amenity] || 0) + quantity;
        }
      }
    }

    if (Object.keys(amenities).length > 0) {
      logger.log(
        `=== EXTRACTED AMENITIES ===\n${JSON.stringify(amenities, null, 2)}\n=== END AMENITIES ===`,
      );
    }

    const lastSentOrder = conversation.lastOrderSentToCashier || {};
    logger.log(
      `=== LAST SENT ORDER (from DB) ===\n${JSON.stringify(lastSentOrder, null, 2)}\n=== END LAST SENT ORDER ===`,
    );

    const orderChanges = calculateOrderChangesUtil(
      lastSentOrder,
      currentOrder,
      logger,
    );
    logger.log(
      `=== ORDER CHANGES (to notify) ===\n${JSON.stringify(orderChanges, null, 2)}\n=== END ORDER CHANGES ===`,
    );

    // Si hay amenidades O cambios de productos, notificar
    if (
      Object.keys(orderChanges).length === 0 &&
      Object.keys(amenities).length === 0
    ) {
      logger.log('No changes or amenities to notify cashier about');
      return;
    }

    // Usar la ubicación guardada en la conversación, o extraerla si no existe
    let tableInfo = conversation.location;
    if (!tableInfo) {
      try {
        tableInfo = await extractTableInfoFromConversationUtil(
          conversation.conversationId,
          conversationService,
          logger,
        );
        // Guardar la ubicación en la conversación si se acaba de extraer
        await conversationService.updateConversationLocation(
          conversation.conversationId,
          tableInfo,
        );
      } catch (error) {
        // Enviar el mensaje de error al cliente (recepción)
        await sendMessageUseCase({
          assistantPhone: branch.phoneNumberAssistant,
          customerPhone: branch.phoneNumberReception!,
          message:
            error.message ||
            'Could not identify the table or location. Could you please specify which table or area you are referring to?',
          logger,
          twilioService,
        });
        logger.warn(
          'Could not identify the table or location, message sent to reception.',
        );
        return;
      }
    }

    const message = await generateCashierMessageUseCase({
      customerName: customer.name,
      menuId: branch.menus[0].id,
      orderChanges,
      tableInfo,
      service: menuService,
      logger,
      amenities: Object.keys(amenities).length > 0 ? amenities : undefined,
    });

    await sendMessageUseCase({
      assistantPhone: branch.phoneNumberAssistant,
      customerPhone: branch.phoneNumberReception!,
      message,
      logger,
      twilioService,
    });

    // IMPORTANTE: currentOrder ya contiene las cantidades ACUMULADAS totales
    // porque el asistente muestra todo el pedido acumulado.
    // Por lo tanto, simplemente guardamos currentOrder como el nuevo lastOrderSentToCashier
    // (no necesitamos sumar nada, currentOrder ES el estado completo actual)

    logger.log(
      `Updating lastOrderSentToCashier with current order: ${JSON.stringify(currentOrder)}`,
    );

    await conversationService.updateLastOrderSentToCashier(
      conversation.conversationId,
      currentOrder,
    );

    logger.log('Cashier notified about confirmed products successfully');
  } catch (error) {
    logger.error('Error notifying cashier about confirmed products:', error);
  }
};
