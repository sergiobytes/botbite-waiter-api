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
    let context = `Eres un asistente de restaurante. Flujo:

PASO 1: Pide ubicación/mesa - ACEPTA cualquier número o "mesa X"
PASO 2: Cliente pide producto(s) → Muestra TODOS los productos agregados → Pregunta "¿Es correcto?" 
PASO 3: Cliente confirma productos → Pregunta "¿Te gustaría agregar algo más?"
PASO 4: Cliente dice "no" o "es todo" → Di "Perfecto, ¿algo más que pueda ayudarte?"
PASO 5: SOLICITUD DE CUENTA - SOLO si cliente pide explícitamente "cuenta", "pagar", "total", "cuánto debo":
- Formato: "Aquí tienes tu cuenta: [LISTA PRODUCTOS] Total: $XXX.XX ¿Es correcto?"
- Esperar confirmación antes de finalizar
PASO 6: Cliente confirma cuenta → Mensaje final específico

MANEJO DE PEDIDOS:
- Mantén una lista mental de TODOS los productos pedidos
- Cuando cliente pida uno o varios productos: Muestra TODOS los agregados + pregunta "¿Es correcto?"
- Cuando cliente confirme: Pregunta "¿Te gustaría agregar algo más?"
- Si cliente pide múltiples productos a la vez, muéstralos todos antes de pedir confirmación
- NUNCA muestres lista parcial o incompleta

MENSAJE FINAL OBLIGATORIO (solo cuando confirmen CUENTA):
Cuando cliente confirme cuenta, responde EXACTAMENTE con este formato:
"¡Perfecto! Gracias por tu pedido. Hemos recibido:

[MOSTRAR PEDIDO COMPLETO CON FORMATO EXACTO]

Tu pedido está ahora en proceso.

¡Gracias por elegirnos!"

EJEMPLOS:

EJEMPLO 1 - Cliente pide un producto:
Cliente: "Torta cubana"
Tú: "He agregado una TORTA CUBANA: $100.00 x 1 = $100.00 ¿Es correcto?"
Cliente: "Sí"
Tú: "Perfecto. ¿Te gustaría agregar algo más?"

EJEMPLO 2 - Cliente pide múltiples productos:
Cliente: "Quiero un refresco y un postre"
Tú: "He agregado:
- REFRESCO FRESA: $40.00 x 1 = $40.00
- COYOTA INDIVIDUAL: $25.00 x 1 = $25.00
¿Es correcto?"
Cliente: "Sí" 
Tú: "Perfecto. ¿Te gustaría agregar algo más?"

EJEMPLO 3 - Cliente termina pedido SIN pedir cuenta:
Cliente: "No quiero nada más"
Tú: "Perfecto, ¿algo más en que pueda ayudarte?"

EJEMPLO 4 - Cliente pide cuenta EXPLÍCITAMENTE:
Cliente: "Dame la cuenta"
Tú: "Aquí tienes tu cuenta:
- TORTA CUBANA: $100.00 x 1 = $100.00
- REFRESCO FRESA: $40.00 x 2 = $80.00
Total: $180.00
¿Es correcto?"

Cliente: "Sí" 
Tú: "¡Perfecto! Gracias por tu pedido. Hemos recibido:
- TORTA CUBANA: $100.00 x 1 = $100.00
- REFRESCO FRESA: $40.00 x 2 = $80.00
Tu pedido está ahora en proceso.
¡Gracias por elegirnos!"

NO digas "no puedo proporcionar" - SIEMPRE muestra el total cuando pidan cuenta.
NO muestres cuenta automáticamente cuando digan "no" - deben pedirla explícitamente.`;

    if (branchContext) {
      context += `\n\nINFORMACIÓN DEL RESTAURANTE:
      - Nombre: ${branchContext.name}
      - Dirección: ${branchContext.address}
      - Teléfono: ${branchContext.phoneNumberReception}`;

      if (branchContext.menus && branchContext.menus.length > 0) {
        context += `\n\nMENÚ DISPONIBLE:`;

        branchContext.menus.forEach((menu) => {
          context += `\n${menu.name}`;
          if (menu.menuItems && menu.menuItems.length > 0) {
            menu.menuItems.forEach((item) => {
              context += `\n • ${item.product.name}: ${item.product.description} - $${item.price}`;
            });
          }
        });
      }
    }

    if (customerContext) {
      context += `\n\nINFORMACIÓN DEL CLIENTE:
      - Nombre: ${customerContext.name}
      - Teléfono: ${customerContext.phone}`;
    }

    return context;
  }

  private filterHistoryAfterLastConfirmation(
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    // Encontrar todos los mensajes de confirmación
    const confirmationIndices: number[] = [];
    let tableInfoMessage: { role: 'user' | 'assistant'; content: string } | null = null;

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
    const filteredHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    
    // Agregar información de mesa si existe
    if (tableInfoMessage) {
      filteredHistory.push(tableInfoMessage);
    }

    // Agregar todas las confirmaciones de pedidos (para mantener el pedido acumulativo)
    for (const index of confirmationIndices) {
      filteredHistory.push(history[index]);
    }

    // Agregar mensajes después de la última confirmación
    const lastConfirmationIndex = confirmationIndices[confirmationIndices.length - 1];
    const messagesAfterLastConfirmation = history.slice(lastConfirmationIndex + 1);
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
      /mesa/,              // cualquier mención de mesa
      /^\d+$/,            // números solos
      /terraza|barra|patio/, // ubicaciones específicas
      /ubicacion|ubicación/, // palabra ubicación
    ];

    return tablePatterns.some(pattern => pattern.test(lowerContent));
  }

  private isValidTableInfo(content: string): boolean {
    const lowerContent = content.toLowerCase().trim();
    
    // Detectar comportamiento inapropiado primero
    if (this.containsInappropriateContent(lowerContent)) {
      return false;
    }

    // Patrones válidos de mesa/ubicación (más flexibles)
    const validTablePatterns = [
      /mesa\s+\d+/,                    // "mesa 5", "mesa 10"
      /en\s+la\s+mesa\s+\d+/,         // "en la mesa 5"
      /estoy\s+en\s+la\s+mesa\s+\d+/, // "estoy en la mesa 5"
      /^\d+$/,                        // solo números "5", "10"
      /(terraza|barra|patio)/,        // ubicaciones específicas válidas
      /planta\s+(alta|baja)\s+mesa\s+\d+/, // "planta alta mesa 5"
      /mesa\s*\d+/,                   // "mesa5", "mesa 5"
    ];

    return validTablePatterns.some(pattern => pattern.test(lowerContent));
  }

  private containsInappropriateContent(content: string): boolean {
    const inappropriateWords = [
      'hola mundo', 'hello world', 'test', 'prueba',
      'pendejo', 'idiota', 'estupido', 'estúpido', 'tonto', 'imbecil', 'imbécil',
      'chinga', 'pinche', 'cabrón', 'cabron', 'puto', 'puta', 'verga', 'culero',
      'mamada', 'mamadas', 'joder', 'coño', 'mierda', 'cagada',
      'fuck', 'shit', 'bitch', 'asshole', 'damn', 'stupid', 'idiot',
      'lorem ipsum', 'asdf', 'qwerty', '123abc', 'testing',
    ];

    return inappropriateWords.some(word => content.includes(word));
  }

  isConfigured(): boolean {
    return !!this.openai;
  }
}
