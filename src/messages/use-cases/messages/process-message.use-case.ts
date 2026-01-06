import { ProcessMessage } from '../../interfaces/messages.interfaces';
import { getOrCreateConversationUseCase } from '../conversations/get-create-conversation.use-case';
import { getConversationHistoryUseCase } from './get-conversation-history.use-case';
import { saveMessageUseCase } from './save-message.use-case';
import { validateQrScanUtil } from '../../utils/validate-qr-scan.util';

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

    // 🚀 VERIFICAR CACHÉ ANTES DE LLAMAR A OPENAI
    let aiResponse: string;

    if (cacheService) {
      const cacheStart = Date.now();
      const conversationContext = messages.slice(-3).map((m) => m.content);
      const cachedResponse = await cacheService.getOpenAICachedResponse(
        branchId!,
        userMessage,
        conversationContext,
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
        );
        logger.log(
          `[PERF] OpenAI response received in ${Date.now() - aiStart}ms`,
        );

        // Guardar en caché
        await cacheService.setOpenAICachedResponse(
          branchId!,
          userMessage,
          aiResponse,
          conversationContext,
          300, // 5 minutos TTL
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
