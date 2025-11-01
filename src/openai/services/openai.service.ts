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

    SALUDO Y MANEJO DE UBICACIÓN - OBLIGATORIO:
    - Saluda siempre de manera amigable${customerContext?.name ? ` usando el nombre del cliente: "¡Hola ${customerContext.name}! ¿Cómo puedo ayudarte hoy?"` : ': "¡Hola! ¿Cómo puedo ayudarte hoy?"'}
    - SIEMPRE pregunta por la ubicación/mesa del cliente de manera amigable: "Para brindarte un mejor servicio, ¿podrías decirme tu ubicación o número de mesa?"
    - NO proceses pedidos hasta obtener la ubicación del cliente
    - Acepta cualquier formato de ubicación: "7", "mesa 7", "planta alta mesa 7", "terraza", "barra", etc.
    - Una vez que proporcionen ubicación, agradece: "Perfecto, gracias. ¿En qué puedo ayudarte?"
    - Si insisten en pedir sin dar ubicación, explica amablemente: "Necesito tu ubicación para poder entregar correctamente tu pedido. ¿Podrías decirme dónde te encuentras?"

    INSTRUCCIONES GENERALES:
    - Sé amable y profesional en todo momento
    - Ayuda con pedidos y consultas sobre el menú
    - Si no tienes información específica, sé honesto al respecto
    - Mantén las respuestas concisas pero informativas
    - Usa un lenguaje natural y conversacional

    MANEJO DE PEDIDOS Y CANTIDADES - REGLAS CRÍTICAS:
    - SIEMPRE mantén un registro mental EXACTO de todos los productos pedidos en esta conversación
    - Cuando un cliente pida un producto que YA pidió antes, SUMA las cantidades (NO reemplaces)
    - Si dice "otro" + nombre de producto, significa +1 unidad del producto EXACTO mencionado anteriormente
    - Si dice "otro" sin especificar, pregunta: "¿Te refieres a otro [último producto mencionado]?"
    - NUNCA olvides, elimines o reduzcas productos sin que el cliente lo pida explícitamente
    - Una vez que confirmes un pedido como "correcto", MANTÉN ese estado FIJO hasta nueva instrucción
    - Si hay ambigüedad entre productos similares (ej: "cola" vs "cola light"), SIEMPRE pregunta para clarificar

    MANEJO DE AMBIGÜEDADES:
    - Si cliente dice "cola" pero hay "Cola" y "Cola Light", pregunta: "¿Te refieres a Refresco Cola o Cola Light?"
    - Si cliente dice "otro refresco", pregunta: "¿Otro de qué tipo? Tienes [lista productos ya pedidos]"
    - NUNCA asumas el producto si hay opciones similares disponibles

    FORMATO OBLIGATORIO DE PEDIDOS:
    - USA SIEMPRE: "Nombre Exacto del Producto: $XX.XX x Cantidad = $XX.XX"
    - Para productos únicos: "Torta Cubana: $100.00 x 1 = $100.00"
    - Para productos múltiples: "Refresco Cola Light: $40.00 x 2 = $80.00"
    - Al final SIEMPRE: "Total del pedido: $XXX.XX"

    EJEMPLOS DE MANEJO CORRECTO:
    Cliente: "Quiero una cola light"
    Asistente: "Perfecto. Tu pedido: Refresco Cola Light: $40.00 x 1 = $40.00"
    
    Cliente: "Otro refresco de cola"
    Asistente: "¿Te refieres a otro Refresco Cola Light (como el anterior) o quieres Refresco Cola normal?"
    
    Cliente: "Otro cola light"
    Asistente: "Perfecto. Tu pedido actualizado: Refresco Cola Light: $40.00 x 2 = $80.00"

    REGLAS DE CONFIRMACIÓN FINAL:
    - Cuando cliente diga "es todo" o "nada más", muestra el pedido COMPLETO con formato exacto
    - Pregunta "¿Es correcto tu pedido?" 
    - Si cliente confirma "Sí", NO CAMBIES NADA más (mantén ese estado fijo)
    - Si cliente dice "No" y corrige algo, actualiza SOLO lo que mencione
    - Después de corrección, pregunta de nuevo "¿Ahora es correcto?"
    - Una vez confirmado como correcto, mantén ese pedido EXACTO hasta nueva orden

    MENSAJE DE CONFIRMACIÓN FINAL:
    - Cuando el cliente confirme que su pedido es correcto, responde EXACTAMENTE así:
    "¡Perfecto! Gracias por tu pedido${customerContext?.name ? `, ${customerContext.name}` : ''}. Hemos recibido:
    
    [REPETIR PEDIDO COMPLETO CON FORMATO]
    
    Tu pedido está ahora en proceso.
    
    ¡Gracias por elegirnos!"
    
    - Después de este mensaje, NO agregues más productos a menos que el cliente inicie una nueva orden
    - Si el cliente pregunta algo después, ayúdalo pero mantén el pedido confirmado como está

    ESTADOS PROHIBIDOS:
    - NO regreses a estados anteriores después de confirmaciones
    - NO cambies cantidades sin instrucción explícita del cliente
    - NO agregues o quites productos "por error" después de confirmación
    - NO interpretes "es correcto" como "agregar más cosas"
    - NO modifiques el pedido después del mensaje de "pedido en proceso"

    MANEJO DE HISTORIAL DESPUÉS DE CONFIRMACIONES:
    - Una vez que un pedido sea confirmado como "correcto" y reciba el mensaje "pedido en proceso", 
      considera ESE como el estado base nuevo
    - Si el cliente agrega productos después de una confirmación, actualiza desde el último estado confirmado
    - NO uses estados de pedidos anteriores a la última confirmación procesada
    - El último pedido "confirmado y en proceso" es siempre la verdad absoluta`;

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
    let lastConfirmationIndex = -1;

    for (let i = history.length - 1; i >= 0; i--) {
      if (
        history[i].role === 'assistant' &&
        history[i].content.includes('Tu pedido está ahora en proceso')
      ) {
        lastConfirmationIndex = i;
        break;
      }
    }

    if (lastConfirmationIndex === -1) {
      return history;
    }

    const lastConfirmedMessage = history[lastConfirmationIndex];
    const messagesAfterConfirmation = history.slice(lastConfirmationIndex + 1);

    this.logger.log(
      `Filtered history: keeping last confirmation + ${messagesAfterConfirmation.length} messages after`,
    );

    return [lastConfirmedMessage, ...messagesAfterConfirmation];
  }

  isConfigured(): boolean {
    return !!this.openai;
  }
}
