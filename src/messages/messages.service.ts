import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WebhookDataTwilio } from './models/webhook-data.twilio';
import { TwilioService } from './services/twilio/twilio.service';
import { BranchesService } from '../branches/branches.service';
import { Customer } from '../customers/entities/customer.entity';
import { CustomersService } from '../customers/customers.service';
import { TranslationService } from '../common/services/translation.service';
import { Branch } from '../branches/entities/branch.entity';
import { OrdersService } from '../orders/orders.service';
import { ConversationService } from './services/conversation/conversation.service';
import { MenusService } from './../menus/menus.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly twilioService: TwilioService,
    private readonly conversationService: ConversationService,
    private readonly translationService: TranslationService,
    private readonly branchService: BranchesService,
    private readonly customerService: CustomersService,
    private readonly menusService: MenusService,
    private readonly orderService: OrdersService,
  ) {}

  async handleWhatsappTwilioMessage(body: WebhookDataTwilio) {
    this.logger.log(
      `Received Twilio webhook: ${JSON.stringify(body, null, 2)}`,
    );

    try {
      await this.processIncomingMessage(body);
      this.logger.log('Message processed successfully');
    } catch (error) {
      this.logger.error('Error processing Twilio webhook');
      throw error;
    }
  }

  async processIncomingMessage(body: WebhookDataTwilio) {
    const messageData = this.twilioService.processIncomingWhatsappMessage(body);

    const { branch } = await this.branchService.findByTerm(
      messageData.to,
      'es',
    );

    if (!branch) {
      throw new NotFoundException(
        this.translationService.translate('errors.branch_not_found', 'en'),
      );
    }

    if (branch.availableMessages === 0) {
      this.logger.warn(
        `Branch ${branch.name} has no available messages left. Message from ${messageData.from} will not be processed.`,
      );
      return;
    }

    const isAdmin = messageData.from === branch.phoneNumberReception;

    let customer: Customer;

    if (!isAdmin) {
      customer = await this.findOrCreateCustomer(
        messageData.from,
        messageData.profileName,
      );
    } else {
      customer = {
        id: 'xxxx',
        name: messageData.profileName,
        phone: messageData.from,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      };
    }

    // Verificar comportamiento inapropiado antes de procesar
    if (this.detectInappropriateBehavior(messageData.message)) {
      await this.notifyCashierAboutInappropriateBehavior(
        messageData.from,
        messageData.message,
        customer,
        branch,
      );

      await this.sendMessage(
        customer.phone,
        'Su comunicación ha sido terminada por comportamiento inapropiado. El personal ha sido notificado.',
        branch.phoneNumberAssistant,
      );
      return;
    }

    const response = await this.conversationService.processMessage(
      messageData.from,
      messageData.message,
      branch.id,
      customer,
      branch,
    );

    // Verificar si el AI detectó comportamiento inapropiado
    if (
      response.includes('COMUNICACIÓN TERMINADA POR COMPORTAMIENTO INAPROPIADO')
    ) {
      await this.notifyCashierAboutInappropriateBehavior(
        messageData.from,
        messageData.message,
        customer,
        branch,
      );
      return; // No enviar la respuesta del AI, ya enviamos mensaje personalizado
    }

    // Limpiar los IDs de los productos antes de enviar al cliente
    const cleanResponse = this.removeMenuItemIds(response);

    await this.sendMessage(
      customer.phone,
      cleanResponse,
      branch.phoneNumberAssistant,
    );

    await this.branchService.updateAvailableMessages(branch);

    // Obtener conversación para verificar si es orden inicial o actualización
    const conversation = await this.conversationService.getOrCreateConversation(
      messageData.from,
      branch.id,
    );

    // Verificar si hay confirmación de productos
    const isInitialConfirmation = this.isInitialOrderConfirmation(response);
    const isProductUpdate = this.isProductConfirmation(messageData.message, response);

    // Solo notificar UNA VEZ si hay confirmación (dar prioridad a isInitialConfirmation)
    if (isInitialConfirmation || isProductUpdate) {
      const isInitialOrder =
        !conversation.lastOrderSentToCashier ||
        Object.keys(conversation.lastOrderSentToCashier).length === 0;

      if (isInitialOrder) {
        this.logger.log(
          'Detected initial order confirmation (lastOrderSentToCashier is empty)',
        );
      } else {
        this.logger.log(
          'Detected product update confirmation (lastOrderSentToCashier has data)',
        );
      }

      // Solo notificar UNA VEZ
      await this.notifyCashierAboutConfirmedProducts(
        messageData.from,
        customer,
        branch,
      );
    }

    // Detectar cuando pide la cuenta (sin necesidad de confirmación)
    if (this.isBillRequest(messageData.message, response)) {
      await this.notifyCashierAboutConfirmedBill(
        messageData.from,
        customer,
        branch,
      );
    }
  }

  private async findOrCreateCustomer(
    phone: string,
    profileName: string,
  ): Promise<Customer> {
    const existingCustomer = await this.customerService.findByTerm(phone, 'en');

    if (existingCustomer.customer) return existingCustomer.customer;

    const customer = await this.customerService.create(
      {
        name: profileName,
        phone,
      },
      'en',
    );

    return customer.customer;
  }

  private async sendMessage(
    to: string,
    message: string,
    fromBranchPhone: string,
  ) {
    try {
      const response = await this.twilioService.sendWhatsAppMessage(
        to,
        message,
        fromBranchPhone,
      );
      this.logger.log(
        `Message sent successfully to ${to} from branch ${fromBranchPhone}`,
      );

      return response;
    } catch (error) {
      this.logger.error(`Failed to send message to ${to}:`, error);
      throw error;
    }
  }

  private extractOrderFromResponse(
    response: string,
  ): Record<
    string,
    { price: number; quantity: number; menuItemId?: string; notes?: string }
  > {
    const order: Record<
      string,
      { price: number; quantity: number; menuItemId?: string; notes?: string }
    > = {};

    // Regex mejorada para capturar: • [ID:xxx] PRODUCTO (CATEGORÍA): $precio x cantidad = $subtotal [Nota: observación]
    // También soporta formato sin ID, sin categoría, sin subtotal, sin cantidad y sin notas
    const orderRegex =
      /[•-]\s*(?:\[ID:([^\]]+)\]\s*)?([^:(]+?)(?:\s*\(([^)]+)\))?\s*:\s*\$(\d+(?:\.\d{2})?)(?:\s*x\s*(\d+)(?:\s*=\s*\$(\d+(?:\.\d{2})?))?)?(?:\s*\[Nota:\s*([^\]]+)\])?/gi;

    let match;
    while ((match = orderRegex.exec(response)) !== null) {
      const menuItemId = match[1]?.trim(); // Capturar ID si existe
      const productName = match[2]
        .trim()
        .replace(/\*\*/g, '') // Remover asteriscos de formato markdown
        .trim();
      // const category = match[3]?.trim(); // Capturar categoría si existe (no se usa por ahora)

      const price = parseFloat(match[4]);
      const quantity = match[5] ? parseInt(match[5]) : 1;
      const notes = match[7]?.trim(); // Capturar observaciones si existen

      // Excluir "Total" y líneas que claramente no son productos
      const lowerName = productName.toLowerCase();
      if (
        lowerName === 'total' ||
        lowerName.includes('total:') ||
        lowerName.startsWith('total') ||
        lowerName.includes('subtotal') ||
        productName.length === 0
      ) {
        continue;
      }

      // Crear una clave única que incluya las observaciones si existen
      // Esto permite separar el mismo producto con diferentes observaciones
      const orderKey = notes ? `${productName}||${notes}` : productName;

      // Si el producto ya existe con las mismas observaciones, sumar las cantidades
      if (order[orderKey]) {
        order[orderKey].quantity += quantity;
      } else {
        order[orderKey] = { price, quantity, menuItemId, notes };
      }
    }

    return order;
  }

  private calculateOrderChanges(
    lastOrder: Record<
      string,
      { price: number; quantity: number; menuItemId?: string; notes?: string }
    >,
    currentOrder: Record<
      string,
      { price: number; quantity: number; menuItemId?: string; notes?: string }
    >,
  ): Record<string, { price: number; quantity: number; menuItemId?: string; notes?: string }> {
    const changes: Record<
      string,
      { price: number; quantity: number; menuItemId?: string; notes?: string }
    > = {};

    for (const [productKey, current] of Object.entries(currentOrder)) {
      const last = lastOrder[productKey];

      if (!last) {
        changes[productKey] = current;
      } else if (current.quantity > last.quantity) {
        changes[productKey] = {
          price: current.price,
          quantity: current.quantity - last.quantity,
          menuItemId: current.menuItemId,
          notes: current.notes,
        };
      }
    }

    return changes;
  }

  private async extractTableInfoFromConversation(
    conversationId: string,
  ): Promise<string> {
    try {
      const history = await this.conversationService.getConversationHistory(
        conversationId,
        50,
      );

      for (const message of history) {
        if (message.role === 'user') {
          const content = message.content.toLowerCase().trim();

          // Patrones con descripción completa
          const mesaMatch = content.match(/mesa\s+(\d+)/);
          if (mesaMatch) {
            return `la mesa ${mesaMatch[1]}`;
          }

          const enLaMesaMatch = content.match(/en\s+la\s+mesa\s+(\d+)/);
          if (enLaMesaMatch) {
            return `la mesa ${enLaMesaMatch[1]}`;
          }

          const tableMatch = content.match(/table\s+(\d+)/);
          if (tableMatch) {
            return `la mesa ${tableMatch[1]}`;
          }

          const numberMatch = content.match(/^(\d+)$/);
          if (numberMatch) {
            return `la mesa ${numberMatch[1]}`;
          }

          const plantaMatch = content.match(/(planta\s+\w+\s+mesa\s+\d+)/);
          if (plantaMatch) {
            return plantaMatch[1];
          }

          const ubicacionMatch = content.match(/(terraza|barra|patio)/);
          if (ubicacionMatch) {
            return `la ${ubicacionMatch[1]}`;
          }
        }
      }

      return 'ubicación no especificada';
    } catch (error) {
      this.logger.warn(
        'Could not extract table info from conversation:',
        error,
      );
      return 'ubicación no especificada';
    }
  }

  private async generateCashierMessage(
    customerName: string,
    tableInfo: string,
    orderChanges: Record<
      string,
      { price: number; quantity: number; menuItemId?: string; notes?: string }
    >,
    menuId: string,
  ): Promise<string> {
    let message = `El cliente ${customerName} que se encuentra en ${tableInfo}, ha pedido:\n\n`;

    // Obtener todos los productos del menú para acceder a las categorías
    const { items: menuItems } = await this.menusService.findMenuItems(
      menuId,
      { limit: 200 },
      {},
      'es',
    );

    for (const [productKey, { price, quantity, menuItemId, notes }] of Object.entries(
      orderChanges,
    )) {
      // Extraer el nombre del producto de la clave (puede tener formato "producto||observaciones")
      const productName = productKey.split('||')[0];
      
      let categoryInfo = '';

      // Encontrar el producto por ID para obtener su categoría
      if (menuItemId) {
        const menuItem = menuItems.find((item) => item.id === menuItemId);
        if (menuItem && menuItem.category) {
          categoryInfo = ` (${menuItem.category.name})`;
        }
      }

      message += `• ${productName}${categoryInfo}: $${price.toFixed(2)} x ${quantity} = $${(price * quantity).toFixed(2)}`;
      
      // Agregar observaciones si existen
      if (notes) {
        message += ` [Nota: ${notes}]`;
      }
      
      message += `\n`;
    }

    return message.trim();
  }

  private isBillRequest(
    clientMessage: string,
    assistantResponse: string,
  ): boolean {
    const clientLower = clientMessage.toLowerCase();
    const responseLower = assistantResponse.toLowerCase();

    // Palabras clave para solicitar cuenta (no solo total)
    const billKeywords = [
      'la cuenta',
      'cuenta por favor',
      'quiero pagar',
      'cuánto debo',
      'cuanto debo',
      'mi cuenta',
      'pagar',
      'cuenta',
    ];

    // Palabras clave solo para consultar total (NO es cuenta)
    const totalOnlyKeywords = [
      'cuánto llevo',
      'cuanto llevo',
      'cuánto va',
      'cuanto va',
      'cuánto es lo que llevo',
      'cuanto es lo que llevo',
    ];

    // Si solo pregunta por el total, NO es una solicitud de cuenta
    const isOnlyTotalRequest = totalOnlyKeywords.some((keyword) =>
      clientLower.includes(keyword),
    );

    if (isOnlyTotalRequest) {
      return false; // No es cuenta, solo quiere saber cuánto lleva
    }

    // Cliente pide la cuenta con palabras clave
    const clientRequestsBill = billKeywords.some((keyword) =>
      clientLower.includes(keyword),
    );

    // Respuesta del asistente contiene la confirmación de cuenta
    const responseContainsBillConfirmation =
      responseLower.includes('aquí tienes tu cuenta:') &&
      responseLower.includes(
        'en unos momentos se acercará alguien de nuestro personal para apoyarte con el pago',
      );

    return clientRequestsBill && responseContainsBillConfirmation;
  }

  private isInitialOrderConfirmation(assistantResponse: string): boolean {
    const responseLower = assistantResponse.toLowerCase();

    // Detecta cuando el cliente confirma su pedido inicial
    // Debe contener la frase completa específica para evitar falsos positivos
    return responseLower.includes(
      'perfecto, gracias por confirmar, tu pedido está ahora en proceso',
    );
  }

  private isProductConfirmation(
    clientMessage: string,
    assistantResponse: string,
  ): boolean {
    const confirmationKeywords = [
      'si',
      'sí',
      'yes',
      'correcto',
      'correct',
      'ok',
      'está bien',
      'asi esta bien',
      'así está bien',
      'perfecto',
      'de acuerdo',
      'exacto',
    ];

    const clientLower = clientMessage.toLowerCase();
    const responseLower = assistantResponse.toLowerCase();

    // Cliente confirma con palabras clave
    const clientConfirms = confirmationKeywords.some((keyword) =>
      clientLower.includes(keyword),
    );

    // AI responde preguntando por más productos O agradeciendo la confirmación
    const aiAsksForMore =
      responseLower.includes(
        'es correcta la orden o te gustaría agregar algo más',
      ) ||
      responseLower.includes('te gustaría agregar algo más') ||
      responseLower.includes('hay algo más que te gustaría ordenar') ||
      responseLower.includes('algo más que pueda ayudarte');

    const aiConfirmsOrder =
      responseLower.includes('perfecto, gracias por confirmar') ||
      responseLower.includes('gracias por confirmar');

    // NO considerar como confirmación de producto si es la confirmación inicial
    // (que ya se maneja con isInitialOrderConfirmation)
    const isInitialConfirmation = responseLower.includes(
      'tu pedido está ahora en proceso',
    );

    return clientConfirms && (aiAsksForMore || aiConfirmsOrder) && !isInitialConfirmation;
  }

  private async notifyCashierAboutConfirmedProducts(
    customerPhone: string,
    customer: Customer,
    branch: Branch,
  ) {
    try {
      const conversation =
        await this.conversationService.getOrCreateConversation(
          customerPhone,
          branch.id,
        );

      // Obtener historial de conversación completo (sin límite para asegurar que encontramos el mensaje correcto)
      const history = await this.conversationService.getConversationHistory(
        conversation.conversationId,
      );

      // Buscar el último mensaje del asistente que tiene productos
      // Debe ser el penúltimo mensaje (el anterior a "Perfecto, gracias por confirmar")
      let productMessage: string | null = null;

      // Buscar desde el final, saltando el último mensaje del asistente (que es la confirmación)
      let assistantMessagesFound = 0;
      for (let i = history.length - 1; i >= 0; i--) {
        const message = history[i];
        if (message.role === 'assistant') {
          assistantMessagesFound++;

          // Saltar el primer mensaje del asistente (la confirmación actual)
          if (assistantMessagesFound === 1) {
            continue;
          }

          // El segundo mensaje del asistente debería tener los productos
          if (
            message.content.includes('• ') && // Debe tener productos en formato bullet
            (message.content.includes('He agregado') ||
              message.content.includes('He actualizado') ||
              message.content.includes('Aquí tienes'))
          ) {
            productMessage = message.content;
            break;
          }
        }
      }

      if (!productMessage) {
        this.logger.warn(
          'Could not find product message in conversation history',
        );
        return;
      }

      const currentOrder = this.extractOrderFromResponse(productMessage);

      if (!currentOrder || Object.keys(currentOrder).length === 0) {
        this.logger.warn('Could not extract order from product message');
        return;
      }

      // Usar lastOrderSentToCashier para comparar cambios
      const lastSentOrder = conversation.lastOrderSentToCashier || {};

      const orderChanges = this.calculateOrderChanges(
        lastSentOrder,
        currentOrder,
      );

      if (Object.keys(orderChanges).length === 0) {
        this.logger.log('No changes to notify cashier about');
        return;
      }

      const tableInfo = await this.extractTableInfoFromConversation(
        conversation.conversationId,
      );

      const message = await this.generateCashierMessage(
        customer.name,
        tableInfo,
        orderChanges,
        branch.menus[0].id,
      );

      await this.sendMessage(
        branch.phoneNumberReception,
        message,
        branch.phoneNumberAssistant,
      );

      // Actualizar la última orden enviada al cajero
      await this.conversationService.updateLastOrderSentToCashier(
        conversation.conversationId,
        currentOrder,
      );

      this.logger.log('Cashier notified about confirmed products successfully');
    } catch (error) {
      this.logger.error(
        'Error notifying cashier about confirmed products:',
        error,
      );
    }
  }

  private async notifyCashierAboutConfirmedBill(
    customerPhone: string,
    customer: Customer,
    branch: Branch,
  ) {
    try {
      const conversation =
        await this.conversationService.getOrCreateConversation(
          customerPhone,
          branch.id,
        );

      // Usar lastOrderSentToCashier como fuente principal de la orden
      const orderFromField = conversation.lastOrderSentToCashier;

      if (!orderFromField || Object.keys(orderFromField).length === 0) {
        this.logger.warn('No order found in lastOrderSentToCashier field');
        return;
      }

      this.logger.log(
        `Using order from lastOrderSentToCashier: ${JSON.stringify(orderFromField)}`,
      );

      const tableInfo = await this.extractTableInfoFromConversation(
        conversation.conversationId,
      );

      // Calcular el total de la orden
      let totalAmount = 0;
      for (const [, { price, quantity }] of Object.entries(orderFromField)) {
        totalAmount += price * quantity;
      }

      const cashierMessage = `El cliente ${customer.name} en ${tableInfo}, ha solicitado su cuenta y está listo para pagar.

Total: $${totalAmount.toFixed(2)}`;

      await this.sendMessage(
        branch.phoneNumberReception,
        cashierMessage,
        branch.phoneNumberAssistant,
      );

      await this.branchService.updateAvailableMessages(branch);

      // Contar interacciones del asistente antes de crear la orden
      const history = await this.conversationService.getConversationHistory(
        conversation.conversationId,
      );

      const assistantInteractions = history.filter(
        (msg) => msg.role === 'assistant',
      ).length;

      this.logger.log(
        `Assistant interactions in conversation: ${assistantInteractions}`,
      );

      // Crear orden usando lastOrderSentToCashier directamente
      const order = await this.createOrderFromLastOrder(
        orderFromField,
        customer.id,
        branch,
      );

      // Actualizar el campo interactions de la orden
      if (order) {
        await this.orderService.updateOrder(
          order.id,
          { interactions: assistantInteractions },
          'es',
        );
        this.logger.log(
          `Order ${order.id} updated with ${assistantInteractions} interactions`,
        );
      }

      // Limpiar conversación después de confirmar cuenta
      await this.conversationService.deleteConversation(
        conversation.conversationId,
      );

      this.logger.log(
        `Bill confirmation notification sent and order created for customer ${customer.name}`,
      );
    } catch (error) {
      this.logger.error('Error notifying cashier about confirmed bill:', error);
    }
  }

  private async createOrderFromLastOrder(
    orderItems: Record<
      string,
      { price: number; quantity: number; menuItemId?: string; notes?: string }
    >,
    customerId: string,
    branch: Branch,
  ) {
    try {
      this.logger.log('Creating order from lastOrderSentToCashier...');

      if (!orderItems || Object.keys(orderItems).length === 0) {
        this.logger.error('No order items in lastOrderSentToCashier');
        return;
      }

      this.logger.log(
        `Processing ${Object.keys(orderItems).length} items from lastOrderSentToCashier`,
      );

      if (!branch.menus || branch.menus.length === 0) {
        this.logger.warn('No menus found for branch');
        return;
      }

      const menuItems = branch.menus[0].menuItems;

      const order = await this.orderService.createOrder(
        {
          branchId: branch.id,
          customerId,
          orderItems: [],
        },
        'es',
      );

      let totalAmount = 0;
      let itemsAdded = 0;

      for (const [productKey, orderItem] of Object.entries(orderItems)) {
        // Extraer el nombre del producto (puede tener formato "producto||observaciones")
        const productName = productKey.split('||')[0];
        
        // Buscar por menuItemId
        if (!orderItem.menuItemId) {
          this.logger.warn(
            `No menuItemId provided for product: "${productName}". Skipping.`,
          );
          continue;
        }

        const menuItem = menuItems.find((m) => m.id === orderItem.menuItemId);

        if (!menuItem) {
          this.logger.warn(
            `Menu item not found by ID: ${orderItem.menuItemId} for product "${productName}"`,
          );
          continue;
        }

        for (let i = 0; i < orderItem.quantity; i++) {
          await this.orderService.addOrderItem(
            order.order.id,
            {
              menuItemId: menuItem.id,
              price: orderItem.price,
              notes: orderItem.notes, // Agregar las observaciones
            },
            'es',
          );

          totalAmount += orderItem.price;
          itemsAdded++;
        }
      }

      this.logger.log(
        `Added ${itemsAdded} items to order. Total: $${totalAmount}`,
      );

      await this.orderService.updateOrder(
        order.order.id,
        { total: totalAmount },
        'es',
      );

      this.logger.log(
        `Order created successfully from lastOrderSentToCashier: ${order.order.id}, Total: $${totalAmount}`,
      );

      return order.order;
    } catch (error) {
      this.logger.error(
        'Error creating order from lastOrderSentToCashier:',
        error,
      );
      throw error;
    }
  }

  private detectInappropriateBehavior(message: string): boolean {
    const lowerMessage = message.toLowerCase().trim();

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

    // Detectar ubicaciones inválidas cuando se pregunta por mesa
    const invalidTableResponses = [
      /mesa\s+(hola|mundo|test|prueba|abc|xyz)/,
      /en\s+la\s+mesa\s+(hola|mundo|test|prueba)/,
    ];

    const hasInappropriateWords = inappropriateWords.some((word) =>
      lowerMessage.includes(word),
    );

    const hasInvalidTableResponse = invalidTableResponses.some((pattern) =>
      pattern.test(lowerMessage),
    );

    return hasInappropriateWords || hasInvalidTableResponse;
  }

  private async notifyCashierAboutInappropriateBehavior(
    customerPhone: string,
    message: string,
    customer: Customer,
    branch: Branch,
  ): Promise<void> {
    try {
      const cashierMessage = `🚨 ALERTA: Comportamiento inapropiado detectado

Cliente: ${customer.name}
Teléfono: ${customerPhone}
Mensaje problemático: "${message}"

Se ha terminado la comunicación automáticamente. 
Revisar si es necesario tomar acción adicional.`;

      await this.sendMessage(
        branch.phoneNumberReception,
        cashierMessage,
        branch.phoneNumberAssistant,
      );

      this.logger.warn(
        `Inappropriate behavior detected from ${customerPhone}: "${message}"`,
      );
    } catch (error) {
      this.logger.error(
        'Error notifying cashier about inappropriate behavior:',
        error,
      );
    }
  }

  /**
   * Elimina los IDs de los productos del mensaje antes de enviarlo al cliente
   * Mantiene la categoría para ayudar al cliente a confirmar el producto correcto
   * Convierte: "• [ID:xxx] Tacos de Pastor (TACOS): $85.00"
   * A: "• Tacos de Pastor (TACOS): $85.00"
   */
  private removeMenuItemIds(message: string): string {
    // Regex para encontrar y remover el patrón [ID:xxx] seguido de espacio
    return message.replace(/\[ID:[^\]]+\]\s*/g, '');
  }
}
