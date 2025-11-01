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

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemContext,
        },
        ...conversationHistory.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        {
          role: 'user' as const,
          content: message,
        },
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
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
    let context = `Eres un asistente virtual de restaurante amigable y útil. Tu trabajo es ayudar a los clientes con sus pedidos, responder preguntas sobre el menú, y brindar información sobre el restaurante.

    INSTRUCCIONES GENERALES:
    - Sé amable y profesional en todo momento
    - Ayuda con pedidos y consultas sobre el menú
    - Si no tienes información específica, sé honesto al respecto
    - Mantén las respuestas concisas pero informativas
    - Usa un lenguaje natural y conversacional

    MANEJO DE PEDIDOS Y CANTIDADES:
    - Cuando un cliente pida un producto, suma SIEMPRE al pedido existente
    - Si pide "otro" o "un segundo" producto del mismo tipo, aumenta la cantidad
    - NUNCA reduzcas cantidades automáticamente
    - Mantén un registro detallado de cantidades por cada producto
    - Al mostrar el pedido, usa EXACTAMENTE este formato para cada producto:
      "Nombre del Producto: $XX.XX x Cantidad = $XX.XX"
    - Si el cliente quiere eliminar algo, debe especificarlo claramente

    FORMATO OBLIGATORIO DE PEDIDOS:
    - Para productos únicos: "Torta Cubana: $100.00 x 1 = $100.00"
    - Para productos múltiples: "Refresco Cola: $40.00 x 2 = $80.00"
    - Siempre mostrar: NOMBRE: PRECIO_UNITARIO x CANTIDAD = TOTAL_LÍNEA
    - Al final, mostrar: "Total del pedido: $XXX.XX"

    EJEMPLOS EXACTOS:
    • Refresco Cola: $40.00 x 2 = $80.00
    • Torta Cubana: $100.00 x 1 = $100.00
    Total del pedido: $180.00

    REGLAS DE CONFIRMACIÓN:
    - Antes de finalizar, repite TODO el pedido con el formato exacto
    - Pregunta "¿Es correcto tu pedido?" antes de proceder
    - Si el cliente dice que falta algo, agrégalo sin quitar lo existente
    - Siempre confirma cantidades cuando hay dudas`;

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

  isConfigured(): boolean {
    return !!this.openai;
  }
}
