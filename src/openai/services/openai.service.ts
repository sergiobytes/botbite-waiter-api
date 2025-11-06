import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { openAIConfig } from '../../config/openai.config';
import { Customer } from '../../customers/entities/customer.entity';
import { Branch } from '../../branches/entities/branch.entity';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly openai: OpenAI;

  constructor() {
    if (!openAIConfig.apiKey) {
      this.logger.warn('OpenAI API key not configured');
      return;
    }

    this.openai = new OpenAI({
      apiKey: openAIConfig.apiKey,
    });

    this.logger.log('OpenAI service initialized');
  }

  createConversation(): string {
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.logger.log(`Conversation created: ${conversationId}`);
    return conversationId;
  }

  async sendMessage(
    conversationId: string,
    message: string,
    conversationHistory: Array<{
      role: 'user' | 'assistant';
      content: string;
    }> = [],
    customerContext?: Customer,
    branchContext?: Branch,
  ): Promise<string> {
    if (!this.openai) throw new Error('OpenAI not configured');

    try {
      const systemContext = this.buildSystemContext(
        customerContext,
        branchContext,
      );

      const filteredHistory =
        this.filterHistoryAfterLastConfirmation(conversationHistory);

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

      const response = await this.openai.chat.completions.create({
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

      this.logger.log(`Response generated for conversation: ${conversationId}`);

      return assistantResponse;
    } catch (error) {
      this.logger.error('Error sending message to OpenAI');

      if (error instanceof Error) {
        throw new Error(`OpenAI API error: ${error.message}`);
      }

      throw new Error('Unknown error occurred while communicating with OpenAI');
    }
  }

  private buildSystemContext(
    customerContext?: Customer,
    branchContext?: Branch,
  ): string {
    return `
Eres un asistente virtual de restaurante. Actúa siempre con tono amable y profesional.

🎯 REGLAS:
- Usa nombres EXACTOS del menú, sin mayúsculas extra ni cambios.
- Formato de línea: "• <Producto>: $<precio> x <cantidad> = $<subtotal>"
- Moneda: $MXN con 2 decimales.
- No inventes productos ni precios.
- No muestres la cuenta salvo que el cliente la pida.
- No menciones que eres IA ni uses tecnicismos.

📋 FLUJO:
1. Si no hay mesa/ubicación, pregunta: “¿Podrías decirme tu número de mesa o en qué parte te encuentras?”
2. Si el cliente pide productos:
   - Muestra lista completa con formato estándar.
   - Pregunta: “¿Es correcta la orden o te gustaría agregar algo más?”
3. Si confirma → responde: “Perfecto, gracias por confirmar, tu pedido está ahora en proceso.”
4. Si agrega o cambia → muestra lista actualizada y repite la pregunta.
5. Si después de un tiempo pide algo nuevo (“otro”, “tráeme”, “agrega”), trátalo como nuevo pedido y usa el mismo flujo.
6. Si pide la cuenta (“cuánto debo”, “pagar”, “total”):
   - Muestra: “Aquí tienes tu cuenta:” + lista + total + “¿Es correcto?”
   - Si confirma → responde: “Perfecto, en unos momentos se acercará alguien de nuestro personal para apoyarte con el pago. Gracias por tu preferencia.”
   - Si corrige → actualiza y vuelve a preguntar.
7. Si pregunta por categorías (“¿qué bebidas tienen?”, “¿qué postres hay?”):
   - Muestra solo esa categoría con nombres y precios.
   - Cierra con: “¿Cuál te ofrezco? Si gustas, dime tamaño o sabor.”

🚫 PROHIBIDO:
- No digas “no puedo proporcionar”.
- No muestres totales sin que los pidan.
- No repitas el flujo ni digas que eres un modelo.

🏪 RESTAURANTE:
${
  branchContext
    ? `
- ${branchContext.name}
- ${branchContext.address}
- Tel: ${branchContext.phoneNumberReception}
${
  branchContext.menus?.length
    ? branchContext.menus
        .map(
          (menu) => `
${menu.name}:
${menu.menuItems?.map((item) => `• ${item.product.name}: ${item.product.description} - $${item.price}`).join('\n')}`,
        )
        .join('\n')
    : ''
}`
    : ''
}

👤 CLIENTE:
${customerContext ? `${customerContext.name}, Tel: ${customerContext.phone}` : 'Sin datos del cliente'}
`;
  }

  private filterHistoryAfterLastConfirmation(
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    // Encontrar todos los mensajes de confirmación
    const confirmationIndices: number[] = [];
    let tableInfoMessage: {
      role: 'user' | 'assistant';
      content: string;
    } | null = null;

    for (let i = 0; i < history.length; i++) {
      const message = history[i];

      // Guardar información de mesa/ubicación (usuario + respuesta del asistente)
      if (message.role === 'user' && this.containsTableInfo(message.content)) {
        tableInfoMessage = message;
        // También incluir la respuesta del asistente que confirma la mesa
        if (i + 1 < history.length) {
          const assistantResponse = history[i + 1];
          if (assistantResponse.role === 'assistant') {
            tableInfoMessage = {
              role: 'assistant',
              content: `${message.content} | ${assistantResponse.content}`,
            };
          }
        }
      }

      // Encontrar mensajes de confirmación
      if (
        message.role === 'assistant' &&
        message.content.includes('Tu pedido está ahora en proceso')
      ) {
        confirmationIndices.push(i);
      }
    }

    // Si no hay confirmaciones, devolver historial completo
    if (confirmationIndices.length === 0) {
      return history;
    }

    // Construir historial filtrado manteniendo información relevante
    const filteredHistory: Array<{
      role: 'user' | 'assistant';
      content: string;
    }> = [];

    // Agregar información de mesa si existe
    if (tableInfoMessage) {
      filteredHistory.push(tableInfoMessage);
    }

    // Agregar todas las confirmaciones de pedidos (para mantener el pedido acumulativo)
    for (const index of confirmationIndices) {
      filteredHistory.push(history[index]);
    }

    // Agregar mensajes después de la última confirmación
    const lastConfirmationIndex =
      confirmationIndices[confirmationIndices.length - 1];
    const messagesAfterLastConfirmation = history.slice(
      lastConfirmationIndex + 1,
    );
    filteredHistory.push(...messagesAfterLastConfirmation);

    this.logger.log(
      `Filtered history: keeping table info + ${confirmationIndices.length} confirmations + ${messagesAfterLastConfirmation.length} messages after last confirmation`,
    );

    return filteredHistory;
  }

  private containsTableInfo(content: string): boolean {
    const lowerContent = content.toLowerCase().trim();

    // Solo buscar patrones básicos de mesa sin validar si son "apropiados"
    // El AI maneja la validación de contenido apropiado
    const tablePatterns = [
      /mesa/, // cualquier mención de mesa
      /^\d+$/, // números solos
      /terraza|barra|patio/, // ubicaciones específicas
      /ubicacion|ubicación/, // palabra ubicación
    ];

    return tablePatterns.some((pattern) => pattern.test(lowerContent));
  }

  private isValidTableInfo(content: string): boolean {
    const lowerContent = content.toLowerCase().trim();

    // Detectar comportamiento inapropiado primero
    if (this.containsInappropriateContent(lowerContent)) {
      return false;
    }

    // Patrones válidos de mesa/ubicación (más flexibles)
    const validTablePatterns = [
      /mesa\s+\d+/, // "mesa 5", "mesa 10"
      /en\s+la\s+mesa\s+\d+/, // "en la mesa 5"
      /estoy\s+en\s+la\s+mesa\s+\d+/, // "estoy en la mesa 5"
      /^\d+$/, // solo números "5", "10"
      /(terraza|barra|patio)/, // ubicaciones específicas válidas
      /planta\s+(alta|baja)\s+mesa\s+\d+/, // "planta alta mesa 5"
      /mesa\s*\d+/, // "mesa5", "mesa 5"
    ];

    return validTablePatterns.some((pattern) => pattern.test(lowerContent));
  }

  private containsInappropriateContent(content: string): boolean {
    const inappropriateWords = [
      'hola mundo',
      'hello world',
      'test',
      'prueba',
      'pendejo',
      'idiota',
      'estupido',
      'estúpido',
      'tonto',
      'imbecil',
      'imbécil',
      'chinga',
      'pinche',
      'cabrón',
      'cabron',
      'puto',
      'puta',
      'verga',
      'culero',
      'mamada',
      'mamadas',
      'joder',
      'coño',
      'mierda',
      'cagada',
      'fuck',
      'shit',
      'bitch',
      'asshole',
      'damn',
      'stupid',
      'idiot',
      'lorem ipsum',
      'asdf',
      'qwerty',
      '123abc',
      'testing',
    ];

    return inappropriateWords.some((word) => content.includes(word));
  }

  isConfigured(): boolean {
    return !!this.openai;
  }
}
