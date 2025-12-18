import OpenAI from 'openai';
import { openAiBuildSystemContext } from '../context/open-ai-build-system-context.use-case';
import { OpenAiSendMessage } from '../interfaces/opean-ai.interfaces';
import { filterHistoryAfterLastConfirmation } from '../utils/filter-history-after-last-confirmation.util';

export const openAiSendMessageUseCase = async (
  params: OpenAiSendMessage,
): Promise<string> => {
  const {
    conversationId,
    message,
    conversationHistory = [],
    customerContext,
    branchContext,
    openai,
    logger,
  } = params;

  if (!openai) throw new Error('OpenAI instance is not configured');

  let filteredHistory = filterHistoryAfterLastConfirmation(
    conversationHistory,
    logger,
  );

  // Limitar historial a últimos 10 mensajes para optimizar tokens
  if (filteredHistory.length > 10) {
    logger.log(
      `Limiting conversation history from ${filteredHistory.length} to 10 messages`,
    );
    filteredHistory = filteredHistory.slice(-10);
  }

  try {
    const systemContext = openAiBuildSystemContext(
      customerContext,
      branchContext,
    );

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemContext,
      },
      ...filteredHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: message,
      },
    ];

    // Timeout de 60 segundos para evitar que se quede colgado
    // Aumentado para soportar carga alta con 100+ usuarios
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('OpenAI request timeout after 60s')),
        60000,
      );
    });

    const responsePromise = openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      max_tokens: 1000, // Aumentado para respuestas completas sin cortes
      temperature: 0.3,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      service_tier: 'auto', // Auto intenta priority, fallback a default si no disponible
    });

    const response = await Promise.race([responsePromise, timeoutPromise]);

    const assistantResponse =
      response.choices[0].message.content ||
      'Lo siento, no pude procesar tu mensaje. ¿Puedes intentarlo de nuevo?';

    logger.log(`Response generated for conversation: ${conversationId}`);

    return assistantResponse;
  } catch (error) {
    logger.error('Error sending message to OpenAI');

    if (error instanceof Error) {
      // Si es error 429 (rate limit), extraer tiempo de espera sugerido
      if (
        error.message.includes('429') &&
        error.message.includes('try again in')
      ) {
        const match = error.message.match(/try again in ([0-9.]+)s/);
        if (match) {
          const waitSeconds = parseFloat(match[1]);
          logger.warn(
            `Rate limit hit, OpenAI suggests waiting ${waitSeconds}s`,
          );
          // Esperar el tiempo sugerido + 1s de margen y reintentar UNA vez
          await new Promise((resolve) =>
            setTimeout(resolve, (waitSeconds + 1) * 1000),
          );
          logger.log(
            `Retrying after rate limit wait for conversation: ${conversationId}`,
          );

          // Reconstruir mensajes para retry
          const retryMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
            [
              {
                role: 'system',
                content: openAiBuildSystemContext(
                  customerContext,
                  branchContext,
                ),
              },
              ...filteredHistory.map((msg) => ({
                role: msg.role,
                content: msg.content,
              })),
              {
                role: 'user' as const,
                content: message,
              },
            ];

          // Reintentar una vez
          try {
            const retryResponse = await openai.chat.completions.create({
              model: 'gpt-4o',
              messages: retryMessages,
              max_tokens: 1000,
              temperature: 0.3,
              top_p: 1,
              frequency_penalty: 0,
              presence_penalty: 0,
              service_tier: 'auto', // Auto para retry también
            });
            return (
              retryResponse.choices[0].message.content ||
              'Lo siento, no pude procesar tu mensaje. ¿Puedes intentarlo de nuevo?'
            );
          } catch {
            logger.error('Retry after rate limit also failed');
            throw new Error(`OpenAI API error after retry: ${error.message}`);
          }
        }
      }
      throw new Error(`OpenAI API error: ${error.message}`);
    }

    throw new Error('Unknown error occurred while communicating with OpenAI');
  }
};
