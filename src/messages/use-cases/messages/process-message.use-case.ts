import { ProcessMessage } from '../../interfaces/messages.interfaces';
import { getOrCreateConversationUseCase } from '../conversations/get-create-conversation.use-case';
import { getConversationHistoryUseCase } from './get-conversation-history.use-case';
import { saveMessageUseCase } from './save-message.use-case';
import { validateQrScanUtil } from '../../utils/validate-qr-scan.util';
import { detectLanguageUtil } from '../../utils/detect-language.util';
import { OrderAction } from './detect-order-action.use-case';

export const processMessageUseCase = async (
  params: ProcessMessage,
): Promise<string> => {
  const {
    phoneNumber,
    userMessage,
    branchId,
    customerContext,
    branchContext,
    logger,
    conversationRepository,
    conversationMessageRepository,
    service,
    cacheService,
    detectTemplateResponseUseCase,
    detectOrderActionUseCase,
    renderOrderResponseUseCase,
    processOrderWithAIUseCase,
  } = params;

  try {
    const startTime = Date.now();
    logger.log(`[PERF] Starting message processing for ${phoneNumber}`);

    const conversation = await getOrCreateConversationUseCase({
      phoneNumber,
      branchId,
      logger,
      repository: conversationRepository,
      service,
    });

    if (!conversation || !conversation.conversationId) {
      throw new Error(
        `Invalid conversation returned for phone ${phoneNumber}: ${JSON.stringify({ id: conversation?.id, conversationId: conversation?.conversationId })}`,
      );
    }

    logger.log(`[PERF] Conversation loaded in ${Date.now() - startTime}ms`);

    const historyStart = Date.now();
    const { messages } = await getConversationHistoryUseCase({
      conversationId: conversation.conversationId,
      repository: conversationMessageRepository,
    });
    logger.log(`[PERF] History loaded in ${Date.now() - historyStart}ms`);

    // ✅ Validar QR solo si no está validado
    if (!conversation.isQrValidated) {
      const { isValidQrScan, token } = validateQrScanUtil(userMessage);

      if (!isValidQrScan) {
        logger.warn(
          `Conversation attempt without QR scan from ${phoneNumber}. Branch: ${branchId}`,
        );

        // ❌ NO llamar a OpenAI, retornar flag especial
        return 'QR_VALIDATION_FAILED';
      }

      if (token !== branchContext?.qrToken) {
        logger.warn(
          `Invalid QR token from ${phoneNumber}. Expected: ${branchContext?.qrToken}, Got: ${token}`,
        );

        // ❌ NO llamar a OpenAI, retornar flag especial
        return 'QR_TOKEN_INVALID';
      }

      // ✅ SOLO aquí validar y guardar
      conversation.isQrValidated = true;
      await conversationRepository.save(conversation);

      logger.log(
        `QR validated for conversation ${conversation.id} with token ${token}`,
      );

      // ✅ Retornar flag de éxito sin procesar el mensaje del token
      return 'QR_VALIDATION_SUCCESS';
    }

    // ✅ Continuar con el flujo normal solo si ya está validado
    const saveStart = Date.now();
    await saveMessageUseCase({
      conversationId: conversation.conversationId,
      role: 'user',
      content: userMessage,
      repository: conversationMessageRepository,
    });
    logger.log(`[PERF] Message saved in ${Date.now() - saveStart}ms`);

    // 🌍 Detectar y guardar idioma preferido si no está configurado
    if (!conversation.preferredLanguage) {
      const detectedLanguage = detectLanguageUtil(userMessage);
      if (detectedLanguage) {
        logger.log(
          `Detected and saving preferred language: ${detectedLanguage}`,
        );
        conversation.preferredLanguage = detectedLanguage;
        await conversationRepository.save(conversation);
      }
    }

    // 🎨 INTENTAR USAR PLANTILLAS PRIMERO (si los use cases están disponibles)
    let aiResponse: string;

    if (detectTemplateResponseUseCase) {
      logger.log('[TEMPLATE] Checking for template-based response...');
      const templateStart = Date.now();

      const templateResult = await detectTemplateResponseUseCase.execute(
        userMessage,
        messages,
        customerContext,
        branchContext,
        conversation.lastOrderSentToCashier,
        conversation.preferredLanguage,
      );

      logger.log(
        `[PERF] Template detection in ${Date.now() - templateStart}ms`,
      );

      if (templateResult.shouldUseTemplate && templateResult.response) {
        logger.log(`✅ Using TEMPLATE response - No OpenAI call needed!`);
        aiResponse = templateResult.response;

        // Guardar respuesta de plantilla
        await saveMessageUseCase({
          conversationId: conversation.conversationId,
          role: 'assistant',
          content: aiResponse,
          repository: conversationMessageRepository,
        });

        logger.log(
          `Message processed successfully with TEMPLATE for conversation: ${conversation.conversationId}`,
        );

        return aiResponse;
      }

      // 📦 Si no es plantilla simple, detectar acciones de orden
      if (
        detectOrderActionUseCase &&
        renderOrderResponseUseCase &&
        processOrderWithAIUseCase
      ) {
        logger.log('[ORDER] Checking for order-related action...');
        const orderDetectionStart = Date.now();

        const orderAction = detectOrderActionUseCase.execute(userMessage);

        logger.log(
          `[PERF] Order detection in ${Date.now() - orderDetectionStart}ms`,
        );

        if (
          orderAction.action !== OrderAction.NONE &&
          orderAction.confidence > 0.7
        ) {
          logger.log(
            `✅ Detected ORDER action: ${orderAction.action} (confidence: ${orderAction.confidence})`,
          );

          // Procesar orden con IA (para extraer datos estructurados)
          const orderProcessStart = Date.now();

          try {
            logger.log(
              `[ORDER] Processing order action with AI + template rendering...`,
            );

            // Usar ProcessOrderWithAIUseCase para extraer datos estructurados
            const processedOrder = await processOrderWithAIUseCase.execute(
              service.getOpenAI(),
              userMessage,
              messages,
              conversation.lastOrderSentToCashier || {},
              branchContext,
            );

            logger.log(
              `[PERF] Order AI processing in ${Date.now() - orderProcessStart}ms`,
            );

            // Renderizar respuesta usando plantillas según la acción
            const renderStart = Date.now();
            let orderResponse: string;

            switch (processedOrder.action) {
              case 'add':
                orderResponse = await renderOrderResponseUseCase.execute(
                  OrderAction.ADD_ITEMS,
                  {
                    items:
                      processedOrder.items?.map((item) => ({
                        id: parseInt(item.id) || 0,
                        name: item.name,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.subtotal,
                      })) || [],
                    subtotal: processedOrder.currentTotal,
                    total: processedOrder.currentTotal,
                  },
                  conversation.preferredLanguage || 'es',
                );
                break;

              case 'confirm':
                orderResponse = await renderOrderResponseUseCase.execute(
                  OrderAction.CONFIRM_ORDER,
                  {
                    items:
                      processedOrder.items?.map((item) => ({
                        id: parseInt(item.id) || 0,
                        name: item.name,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.subtotal,
                      })) || [],
                    subtotal: processedOrder.currentTotal,
                    total: processedOrder.currentTotal,
                  },
                  conversation.preferredLanguage || 'es',
                  {
                    orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
                    estimatedTime: '15-20 minutos',
                  },
                );
                break;

              case 'request_bill':
                orderResponse = await renderOrderResponseUseCase.execute(
                  OrderAction.REQUEST_BILL,
                  {
                    items:
                      processedOrder.items?.map((item) => ({
                        id: parseInt(item.id) || 0,
                        name: item.name,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.subtotal,
                      })) || [],
                    subtotal: processedOrder.currentTotal,
                    tax: processedOrder.currentTotal * 0.16,
                    total: processedOrder.currentTotal * 1.16,
                  },
                  conversation.preferredLanguage || 'es',
                );
                break;

              case 'separate_bills':
                if (processedOrder.separateBills) {
                  orderResponse = await renderOrderResponseUseCase.execute(
                    OrderAction.SEPARATE_BILLS,
                    processedOrder.separateBills.map((bill) => ({
                      customer: bill.customerName,
                      items: bill.items.map((item) => ({
                        id: parseInt(item.id) || 0,
                        name: item.name,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.subtotal,
                      })),
                      total: bill.subtotal,
                    })),
                    conversation.preferredLanguage || 'es',
                  );
                } else {
                  // Fallback si no hay datos de separación
                  throw new Error('No separate bill data available');
                }
                break;

              case 'show_cart':
                orderResponse = await renderOrderResponseUseCase.execute(
                  OrderAction.VIEW_ORDER,
                  {
                    items:
                      processedOrder.items?.map((item) => ({
                        id: parseInt(item.id) || 0,
                        name: item.name,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.subtotal,
                      })) || [],
                    subtotal: processedOrder.currentTotal,
                    total: processedOrder.currentTotal,
                  },
                  conversation.preferredLanguage || 'es',
                );
                break;

              default:
                // Para acciones 'modify' o 'remove', usar el mensaje de IA
                orderResponse =
                  processedOrder.message ||
                  'Orden procesada correctamente.';
            }

            logger.log(
              `[PERF] Order template rendering in ${Date.now() - renderStart}ms`,
            );

            aiResponse = orderResponse;

            // Guardar respuesta de orden
            await saveMessageUseCase({
              conversationId: conversation.conversationId,
              role: 'assistant',
              content: aiResponse,
              repository: conversationMessageRepository,
            });

            logger.log(
              `Message processed successfully with ORDER + TEMPLATE for conversation: ${conversation.conversationId}`,
            );

            return aiResponse;
          } catch (orderError) {
            logger.error(
              `Error processing order with AI: ${orderError.message}`,
              orderError.stack,
            );
            // Caer en el flujo normal de OpenAI si falla el procesamiento de orden
            logger.log(
              '[ORDER] Falling back to standard OpenAI processing due to error',
            );
          }
        }
      }
    }

    // 🚀 VERIFICAR CACHÉ ANTES DE LLAMAR A OPENAI

    if (cacheService) {
      const cacheStart = Date.now();
      const conversationContext = messages.slice(-3).map((m) => m.content);
      const cachedResponse = await cacheService.getOpenAICachedResponse(
        branchId!,
        userMessage,
        conversationContext,
        phoneNumber, // Cache por cliente para evitar respuestas mezcladas
      );
      logger.log(`[PERF] Cache check in ${Date.now() - cacheStart}ms`);

      if (cachedResponse) {
        logger.log(`✅ Using CACHED response - Saved OpenAI call!`);
        aiResponse = cachedResponse;
      } else {
        // Cache miss - llamar a OpenAI
        const aiStart = Date.now();
        logger.log(
          `[PERF] Calling OpenAI for conversation ${conversation.conversationId}`,
        );
        aiResponse = await service.sendMessage(
          conversation.conversationId,
          userMessage,
          messages,
          customerContext,
          branchContext,
          conversation.location,
          conversation.lastOrderSentToCashier,
          conversation.preferredLanguage,
        );
        logger.log(
          `[PERF] OpenAI response received in ${Date.now() - aiStart}ms`,
        );

        // Guardar en caché (usa CACHE_TTL de env)
        await cacheService.setOpenAICachedResponse(
          branchId!,
          userMessage,
          aiResponse,
          conversationContext,
          undefined, // ttl (usa defaultTTL)
          phoneNumber, // Cache por cliente
        );
      }
    } else {
      // Fallback sin caché
      const aiStart = Date.now();
      logger.log(
        `[PERF] Calling OpenAI for conversation ${conversation.conversationId}`,
      );
      aiResponse = await service.sendMessage(
        conversation.conversationId,
        userMessage,
        messages,
        customerContext,
        branchContext,
        conversation.location,
        conversation.lastOrderSentToCashier,
        conversation.preferredLanguage,
      );
      logger.log(
        `[PERF] OpenAI response received in ${Date.now() - aiStart}ms`,
      );
    }

    await saveMessageUseCase({
      conversationId: conversation.conversationId,
      role: 'assistant',
      content: aiResponse,
      repository: conversationMessageRepository,
    });

    logger.log(
      `Message processed successfully for conversation: ${conversation.conversationId}`,
    );

    return aiResponse;
  } catch (error) {
    logger.log('Error processing message: ', error);
    throw error;
  }
};
