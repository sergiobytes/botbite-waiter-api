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
  } = params;

  try {
    const conversation = await getOrCreateConversationUseCase({
      phoneNumber,
      branchId,
      logger,
      repository: conversationRepository,
      service,
    });

    const { messages } = await getConversationHistoryUseCase({
      conversationId: conversation.conversationId,
      repository: conversationMessageRepository,
    });

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
    await saveMessageUseCase({
      conversationId: conversation.conversationId,
      role: 'user',
      content: userMessage,
      repository: conversationMessageRepository,
    });

    const aiResponse = await service.sendMessage(
      conversation.conversationId,
      userMessage,
      messages,
      customerContext,
      branchContext,
    );

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
