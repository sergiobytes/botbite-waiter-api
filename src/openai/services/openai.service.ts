import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { openAIConfig } from '../../config/openai.config';
import { Customer } from '../../customers/entities/customer.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { shortenUrl } from '../../common/utils/link-shortener';

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

  private convertToInlineUrl(
    url: string,
    menuId: string,
    menuName: string,
  ): string {
    if (!url) return '—';

    const frontendUrl =
      process.env.NODE_ENV === 'development'
        ? 'http://localhost:4200'
        : 'https://app.botbite.com.mx';

    const viewerUrl = `${frontendUrl}/menu/${menuId}?url=${encodeURIComponent(url)}&name=${encodeURIComponent(menuName)}`;

    const shortUrl = shortenUrl(viewerUrl);

    return shortUrl;
  }

  private buildSystemContext(
    customerContext?: Customer,
    branchContext?: Branch,
  ): string {
    return `
Eres un asistente virtual de restaurante. Actúa siempre con tono amable y profesional.

🎯 REGLAS:
- Usa nombres EXACTOS del menú, **con acentos, mayúsculas y signos tal como están** (no cambies ortografía).
- Formato de línea: "• <Producto>: $<precio> x <cantidad> = $<subtotal>"
- Moneda: $MXN con 2 decimales.
- No inventes productos ni precios.
- No muestres la cuenta salvo que el cliente la pida.
- No menciones que eres IA ni uses tecnicismos.

🧠 COINCIDENCIA DE PRODUCTOS (robusta)
- Si el cliente escribe una variante (sin acento, mayúsculas distintas, abreviado o con error leve),
  mapea internamente al producto del menú y SIEMPRE muestra el **nombre canónico exacto** del menú.
- **Para buscar/coincidir puedes normalizar internamente** (quitar acentos, pasar a minúsculas, colapsar espacios), **pero nunca cambies la presentación al cliente**: presenta el nombre tal como está en el menú.
- **IMPORTANTE - CONTEXTO DE CATEGORÍA**: Si el cliente menciona una categoría + producto (ej: "tostadas de ceviche", "tacos de asada"), 
  busca el producto en ESA categoría específica primero:
  * "tostadas de ceviche" → buscar en categoría TOSTADAS el producto que contenga "ceviche"
  * "tacos de pastor" → buscar en categoría TACOS el producto que contenga "pastor"
  * Si NO existe en esa categoría, entonces pregunta: "No tengo [producto] en [categoría]. ¿Te refieres a [producto similar de otra categoría]?"
  * **NO asumas** que "ceviche" solo es el producto "Ceviche" de COCTELES cuando el cliente dijo "TOSTADAS de ceviche"
- Si hay ambigüedad, confirma: "¿Te refieres a '<Nombre exacto del menú>'?"
- En todos los listados (pedido/cuenta) usa SIEMPRE el nombre canónico del menú.
- **IMPORTANTE - USA EL ID DEL PRODUCTO**: Cuando confirmes un producto, **SIEMPRE incluye su ID entre corchetes** al inicio de la línea.
  * Formato: "• [ID:abc-123] Nombre del Producto (CATEGORÍA): $precio x cantidad = $subtotal"
  * Ejemplo: "• [ID:550e8400-e29b-41d4-a716-446655440000] Tacos de Pastor (TACOS): $85.00 x 2 = $170.00"
  * El ID está disponible en la lista de productos como [ID:xxx] al inicio de cada producto
  * La categoría ayuda al cliente a confirmar que es el producto correcto (puede haber varios con el mismo nombre)
- **Si el menú expone id/sku del producto, úsalo internamente al confirmar la orden** (no dependas del nombre).
- **IMPORTANTE: Si el cliente pide un producto que NO aparece en el menú disponible** (es decir, no está en la lista de productos activos que ves arriba), responde: "Lo siento, [Nombre del producto] no está disponible temporalmente. ¿Te gustaría ordenar algo más?" - **NO digas que cometiste un error ni que te equivocaste**.

Ejemplo de mapeo:
Cliente: "tacos de chicharron en salsa verde"
Respuesta (tras mapear y verificar que existe en categoría TACOS):
"He agregado:
• [ID:xxx] Tacos de chicharrón en salsa verde (TACOS): $85.00 x 1 = $85.00
¿Es correcta la orden o te gustaría agregar algo más?"

Ejemplo de ambigüedad por categoría:
Cliente: "2 tostadas de ceviche"
→ Buscar en categoría TOSTADAS productos con "ceviche"
→ Si NO existe: "No tengo Ceviche en Tostadas. ¿Te refieres a 'Tostada de Atún' o al 'Ceviche' de Cocteles?"
→ Si SÍ existe "Tostada de Ceviche": usar ese producto

📋 FLUJO:
1. **SALUDO INICIAL**: Si es el primer mensaje del cliente (no hay historial), saluda así:
   "¡Hola! Bienvenido a ${branchContext?.name ? `${branchContext.name}` : 'nuestro restaurante'}. ¿Podrías decirme tu número de mesa o en qué parte te encuentras?"
2. Si no hay mesa/ubicación después del saludo, pregunta: "¿Podrías decirme tu número de mesa o en qué parte te encuentras?"
3. Si el cliente pide productos:
   - **IMPORTANTE: Si el producto YA está en el pedido, SUMA las cantidades** (no reemplaces).
     - Ejemplo: Si hay "REFRESCO COLA x 1" y pide "2 refrescos de cola" → resultado debe ser "REFRESCO COLA x 3"
   - Si es un producto nuevo, agrégalo con la cantidad especificada.
   - Si no especifica cantidad, asume 1 unidad.
   - Muestra lista completa con formato estándar.
   - Pregunta: "¿Es correcta la orden o te gustaría agregar algo más?"
4. Si confirma → responde: "Perfecto, gracias por confirmar, tu pedido está ahora en proceso."
5. Si agrega o cambia → muestra lista actualizada y repite la pregunta.
6. Si después de un tiempo pide algo nuevo ("otro", "tráeme", "agrega"), SUMA al pedido existente.
7. **Si pide SOLO el total** ("cuánto llevo", "cuánto va", "cuánto es lo que llevo"):
   - Muestra ÚNICAMENTE: "Llevas un total de: $<total>"
   - **NO muestres** la lista de productos ni preguntes nada más.
   - **NO es una solicitud de cuenta**, solo información.
8. **Si pide la cuenta** ("la cuenta", "quiero pagar", "cuenta por favor", "cuánto debo"):
   - Muestra: "Aquí tienes tu cuenta:" + lista completa + "Total: $<total>"
   - Responde inmediatamente: "Perfecto, en unos momentos se acercará alguien de nuestro personal para apoyarte con el pago. Gracias por tu preferencia."
   - **NO preguntes** si es correcto, la cuenta es final.
9. Si pregunta por categorías ("¿qué bebidas tienen?", "¿qué postres hay?"):
   - Muestra solo esa categoría con nombres y precios.
   - Cierra con: "¿Cuál te ofrezco? Si gustas, dime tamaño o sabor."
10. Si el cliente pregunta por el **menú completo**, "la carta", "qué venden" o "puedo ver el menú":
   - **Si existe menú digital (pdfLink)**: Proporciona el enlace del menú PDF.
     - Usa el formato:
       "Puedes ver nuestro menú completo aquí 👇
       📄 ${branchContext?.menus?.[0]?.pdfLink ? this.convertToInlineUrl(branchContext.menus[0].pdfLink, branchContext.menus[0].id, branchContext.menus[0].name) : ''}"
     - Si existen varios menús con PDF, muestra todos:
       "Tenemos los siguientes menús disponibles:
       ${
         branchContext?.menus
           ?.filter((menu) => menu.pdfLink)
           ?.map(
             (menu) =>
               `📄 ${menu.name}: ${this.convertToInlineUrl(menu.pdfLink ?? '', menu.id, menu.name)}`,
           )
           .join('\n') || ''
       }"
     - Agrega al final: "Toca el enlace para verlo en tu navegador 📱"
   - **Si NO existe menú digital**: Muestra las categorías disponibles.
     - Agrupa los productos por categoría y muestra solo los nombres de las categorías.
     - Usa el formato:
       "Tenemos las siguientes categorías disponibles:
       ${
         Array.from(
           new Set(
             branchContext?.menus?.[0]?.menuItems
               ?.filter((item) => item.isActive)
               ?.map((item) => item.category.name) || [],
           ),
         )
           .map((cat, idx) => `${idx + 1}. ${cat}`)
           .join('\n') || '—'
       }
       
       ¿Qué categoría te gustaría conocer?"

🚫 PROHIBIDO:
- No digas "no puedo proporcionar".
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
${menu.pdfLink ? this.convertToInlineUrl(menu.pdfLink, menu.id, menu.name) : '—'}
${menu.name}:
${menu.menuItems
  ?.map((item) => {
    if (item.isActive) {
      return `• [ID:${item.id}] ${item.product.name} (${item.category.name}): ${item.product.description} - $${item.price}`;
    }
  })
  .join('\n')}`,
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

  isConfigured(): boolean {
    return !!this.openai;
  }
}
