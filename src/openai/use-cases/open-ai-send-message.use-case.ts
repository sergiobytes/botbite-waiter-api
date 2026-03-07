import OpenAI from 'openai';
import { buildDynamicSystemContext } from '../context/build-dynamic-system-context.use-case';
import { OpenAiSendMessage } from '../interfaces/opean-ai.interfaces';
import { filterHistoryAfterLastConfirmation } from '../utils/filter-history-after-last-confirmation.util';
import { detectCustomerIntention } from '../utils/detect-customer-intention.util';
import { countOffTopicRedirectionsUtil } from '../../messages/utils/count-off-topic-redirections.util';
import { fixOrderTotalUtil } from '../utils/fix-order-total.util';

export const openAiSendMessageUseCase = async (
  params: OpenAiSendMessage,
): Promise<string> => {
  const {
    conversationId,
    message,
    conversationHistory = [],
    customerContext,
    branchContext,
    conversationLocation,
    lastOrderSentToCashier,
    preferredLanguage,
    openai,
    logger,
  } = params;

  if (!openai) throw new Error('OpenAI instance is not configured');

  let filteredHistory = filterHistoryAfterLastConfirmation(
    conversationHistory,
    logger,
  );

  // Limitar historial a últimos 20 mensajes para dar más contexto a gpt-4o-mini
  // Mini necesita más historial que gpt-4o para recordar pedidos correctamente
  if (filteredHistory.length > 20) {
    logger.log(
      `Limiting conversation history from ${filteredHistory.length} to 20 messages`,
    );
    filteredHistory = filteredHistory.slice(-20);
  }

  // Detectar la intención del cliente para seleccionar el prompt más apropiado
  const intention = detectCustomerIntention(
    message,
    filteredHistory,
    conversationLocation,
  );

  logger.log(
    `Detected intention: ${intention} for conversation: ${conversationId}`,
  );

  // CRITICAL: Detectar preguntas sobre productos específicos y forzar flujo de foto
  let enhancedMessage = message;

  // PASO 1: Detectar si el cliente está respondiendo "Sí" a una pregunta sobre ver foto
  const lastBotMessage =
    filteredHistory.length > 0
      ? filteredHistory[filteredHistory.length - 1]
      : null;

  const affirmativeResponses = /^(s[ií]|yes|ok|dale|claro|por\s+favor|please|oui|d'accord|네|확인|yeah|yep|sure)$/i;

  if (
    lastBotMessage &&
    lastBotMessage.role === 'assistant' &&
    affirmativeResponses.test(message.trim())
  ) {
    // Detectar si el último mensaje del bot preguntó sobre ver una foto
    const photoQuestionPattern = /¿te\s+gustaría\s+ver\s+una\s+foto\s+de\s+los?\s+\*([^*]+)\*/i;
    const photoQuestionMatch = lastBotMessage.content.match(photoQuestionPattern);

    if (photoQuestionMatch && branchContext?.menus) {
      const productNameFromQuestion = photoQuestionMatch[1].trim();
      logger.log(
        `Client said yes to photo question for product: ${productNameFromQuestion}`,
      );

      // Buscar el producto y su foto en el menú
      for (const menu of branchContext.menus) {
        if (menu.menuItems) {
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

          if (item?.product?.imageUrl && item.product.imageUrl.trim()) {
            const productName = item.product.name;
            const imageUrl = item.product.imageUrl;
            logger.log(
              `Forcing photo send for product "${productName}" with URL: ${imageUrl}`,
            );

            enhancedMessage = `${message}

[INSTRUCCIÓN CRÍTICA DEL SISTEMA - DEBES OBEDECER]:
El cliente acaba de confirmar que quiere ver la foto de ${productName}.
ACCIÓN OBLIGATORIA INMEDIATA:
1. ENVÍA la foto usando EXACTAMENTE este formato (copia y pega):
   [SEND_IMAGE:${imageUrl}]
   Aquí tienes la foto.
   
2. DESPUÉS de la foto, pregunta: "¿Deseas agregar los *${productName}* a tu pedido?"

NO uses ninguna otra plantilla. NO digas que el pedido está vacío. 
SOLO envía la foto y pregunta si quiere agregarlo.`;
            break;
          }
        }
      }
    }
  }

  // PASO 2: Detectar preguntas iniciales sobre productos y forzar flujo de foto
  if (enhancedMessage === message) { // Solo si no se modificó en PASO 1
    const productQuestionPatterns = [
      /qu[eé]\s+(?:son|es|tiene|lleva|hay\s+en)\s+(?:los?\s+)?(.+?)(?:\?|$)/i,
      /(?:what|whats)\s+(?:is|are|in)\s+(?:the\s+)?(.+?)(?:\?|$)/i,
      /cuales\s+son\s+(?:los?\s+)?(.+?)(?:\?|$)/i,
    ];

    for (const pattern of productQuestionPatterns) {
      const match = message.match(pattern);
      if (match && branchContext?.menus) {
        const potentialProductName = match[1]
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');

        // Buscar el producto en el menú
        for (const menu of branchContext.menus) {
          if (menu.menuItems) {
            const item = menu.menuItems.find((mi) => {
              const menuProductName = mi.product.name
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
              return (
                menuProductName.includes(potentialProductName) ||
                potentialProductName.includes(menuProductName)
              );
            });

            if (item?.product?.imageUrl && item.product.imageUrl.trim()) {
              const productName = item.product.name;
              logger.log(
                `Product "${productName}" found with photo - enforcing photo prompt workflow`,
              );
              enhancedMessage = `${message}

[INSTRUCCIÓN CRÍTICA DEL SISTEMA - OBLIGATORIO SEGUIR]:
El producto ${productName} tiene foto disponible (imageUrl).
WORKFLOW OBLIGATORIO:
1. Explica el producto
2. INMEDIATAMENTE después pregunta: "¿Te gustaría ver una foto de los *${productName}*?"
3. DETENTE - NO preguntes todavía si quiere agregarlo
4. ESPERA respuesta del cliente sobre la foto
Si NO sigues este workflow exactamente, la respuesta será rechazada.`;
              break;
            }
          }
        }
        break;
      }
    }
  }

  // Contar cuántas veces hemos redirigido por conversación fuera de contexto
  const offTopicRedirectionCount =
    countOffTopicRedirectionsUtil(filteredHistory);
  if (offTopicRedirectionCount > 0) {
    logger.log(
      `Off-topic redirections count: ${offTopicRedirectionCount} for conversation: ${conversationId}`,
    );
  }

  try {
    // Construir contexto del sistema dinámicamente según la intención
    const systemContext = buildDynamicSystemContext(
      intention,
      customerContext,
      branchContext,
      offTopicRedirectionCount,
      lastOrderSentToCashier,
      preferredLanguage,
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
        content: enhancedMessage, // Usar mensaje mejorado con instrucciones de foto si aplica
      },
    ];

    // Timeout de 60 segundos - OpenAI puede tardar 20-40s bajo carga
    // Balanceado para evitar timeouts innecesarios manteniendo buena UX
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('OpenAI request timeout after 60s')),
        60000,
      );
    });

    // Selección de modelo basada en INTENCIÓN (más inteligente que por longitud)
    // Tareas simples → gpt-4o-mini (rápido, barato)
    // Tareas complejas → gpt-4o (más preciso, menos errores)
    const simpleIntentions = [
      'language_selection',
      'location_needed',
      'view_menu',
      'confirm_order',
      'total_query',
      'payment_method',
      'request_amenities',
    ];

    const useGpt4oMini = simpleIntentions.includes(intention);
    const model = useGpt4oMini ? 'gpt-4o-mini' : 'gpt-4o';
    const maxTokens = useGpt4oMini ? 800 : 1500;

    logger.log(`Using model: ${model} for intention: ${intention}`);

    const responsePromise = openai.chat.completions.create({
      model,
      messages: messages,
      max_tokens: maxTokens,
      temperature: 0.3,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    const response = await Promise.race([responsePromise, timeoutPromise]);

    let assistantResponse =
      response.choices[0].message.content ||
      'Lo siento, no pude procesar tu mensaje. ¿Puedes intentarlo de nuevo?';

    logger.log(`Response generated for conversation: ${conversationId}`);

    // POST-PROCESAMIENTO FINAL: Corregir el total del pedido
    // El backend calcula el total correcto basado en lastOrderSentToCashier (fuente de verdad)
    assistantResponse = fixOrderTotalUtil(
      assistantResponse,
      logger,
      lastOrderSentToCashier || undefined,
    );

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
          const waitSeconds = Math.min(parseFloat(match[1]), 5); // Máximo 5 segundos de espera
          logger.warn(
            `Rate limit hit, OpenAI suggests waiting ${waitSeconds}s (capped at 5s)`,
          );
          // Esperar tiempo sugerido (máximo 5s) y reintentar UNA vez
          await new Promise((resolve) =>
            setTimeout(resolve, waitSeconds * 1000),
          );
          logger.log(
            `Retrying after rate limit wait for conversation: ${conversationId}`,
          );

          // Reconstruir mensajes para retry
          const retryMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
            [
              {
                role: 'system',
                content: buildDynamicSystemContext(
                  intention,
                  customerContext,
                  branchContext,
                  offTopicRedirectionCount,
                  lastOrderSentToCashier,
                  preferredLanguage,
                ),
              },
              ...filteredHistory.map((msg) => ({
                role: msg.role,
                content: msg.content,
              })),
              {
                role: 'user' as const,
                content: enhancedMessage, // Usar mensaje mejorado también en retry
              },
            ];

          // Reintentar una vez
          try {
            const retryResponse = await openai.chat.completions.create({
              model: 'gpt-4o',
              messages: retryMessages,
              max_tokens: 800,
              temperature: 0.3,
              top_p: 1,
              frequency_penalty: 0,
              presence_penalty: 0,
            });
            let retryContent =
              retryResponse.choices[0].message.content ||
              'Lo siento, no pude procesar tu mensaje. ¿Puedes intentarlo de nuevo?';

            // Corregir total en retry también
            retryContent = fixOrderTotalUtil(
              retryContent,
              logger,
              lastOrderSentToCashier || undefined,
            );

            return retryContent;
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
