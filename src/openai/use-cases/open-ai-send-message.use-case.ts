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

  try {
    const systemContext = openAiBuildSystemContext(
      customerContext,
      branchContext,
    );

    const filteredHistory = filterHistoryAfterLastConfirmation(
      conversationHistory,
      logger,
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

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      max_tokens: 1000,
      temperature: 0.3,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    const assistantResponse =
      response.choices[0].message.content ||
      'Lo siento, no pude procesar tu mensaje. ¿Puedes intentarlo de nuevo?';

    logger.log(`Response generated for conversation: ${conversationId}`);

    return assistantResponse;
  } catch (error) {
    logger.error('Error sending message to OpenAI');

    if (error instanceof Error) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }

    throw new Error('Unknown error occurred while communicating with OpenAI');
  }
};
