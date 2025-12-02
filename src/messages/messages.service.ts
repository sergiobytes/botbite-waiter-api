import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WebhookDataTwilio } from './models/webhook-data.twilio';
import { TwilioService } from './services/twilio/twilio.service';
import { BranchesService } from '../branches/branches.service';
import { Customer } from '../customers/entities/customer.entity';
import { CustomersService } from '../customers/customers.service';
import { TranslationService } from '../common/services/translation.service';
import { Branch } from '../branches/entities/branch.entity';
import { ProductsService } from '../products/products.service';
import { OrdersService } from '../orders/orders.service';
import { ConversationService } from './services/conversation/conversation.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly twilioService: TwilioService,
    private readonly conversationService: ConversationService,
    private readonly translationService: TranslationService,
    private readonly branchService: BranchesService,
    private readonly customerService: CustomersService,
    private readonly productsService: ProductsService,
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

    const branch = await this.branchService.findByTerm(messageData.to);

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

    await this.sendMessage(
      customer.phone,
      response,
      branch.phoneNumberAssistant,
    );

    await this.branchService.updateAvailableMessages(branch);

    // 1. Notificar cuando se confirma pedido inicial
    if (this.isInitialOrderConfirmation(response)) {
      await this.notifyCashierAboutConfirmedProducts(
        messageData.from,
        customer,
        branch,
      );
    }

    // 2. Notificar cuando cliente confirma productos agregados/modificados
    if (this.isProductConfirmation(messageData.message, response)) {
      // Necesitamos la conversación para obtener el mensaje anterior con los productos
      await this.notifyCashierAboutConfirmedProducts(
        messageData.from,
        customer,
        branch,
      );
    }

    // 3. Solo ejecutar notificación y creación de orden después de confirmación de cuenta
    if (this.isBillConfirmation(messageData.message, response)) {
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
  ): Record<string, { price: number; quantity: number }> {
    const order: Record<string, { price: number; quantity: number }> = {};

    // Regex mejorada para capturar el formato: • PRODUCTO: $precio x cantidad = $subtotal
    // También soporta formato sin subtotal: • PRODUCTO: $precio x cantidad
    // Y formato simple: • PRODUCTO: $precio
    const orderRegex =
      /[•-]\s*([^:]+?):\s*\$(\d+(?:\.\d{2})?)(?:\s*x\s*(\d+)(?:\s*=\s*\$(\d+(?:\.\d{2})?))?)?/gi;

    let match;
    while ((match = orderRegex.exec(response)) !== null) {
      const productName = match[1]
        .trim()
        .replace(/\*\*/g, '') // Remover asteriscos de formato markdown
        .trim();

      const price = parseFloat(match[2]);
      const quantity = match[3] ? parseInt(match[3]) : 1;

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

      // Si el producto ya existe, sumar las cantidades
      if (order[productName]) {
        order[productName].quantity += quantity;
      } else {
        order[productName] = { price, quantity };
      }
    }

    this.logger.debug(`Extracted order: ${JSON.stringify(order)}`);
    return order;
  }

  private calculateOrderChanges(
    lastOrder: Record<string, { price: number; quantity: number }>,
    currentOrder: Record<string, { price: number; quantity: number }>,
  ): Record<string, { price: number; quantity: number }> {
    const changes: Record<string, { price: number; quantity: number }> = {};

    for (const [productName, current] of Object.entries(currentOrder)) {
      const last = lastOrder[productName];

      if (!last) {
        changes[productName] = current;
      } else if (current.quantity > last.quantity) {
        changes[productName] = {
          price: current.price,
          quantity: current.quantity - last.quantity,
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

  private generateCashierMessage(
    customerName: string,
    tableInfo: string,
    orderChanges: Record<string, { price: number; quantity: number }>,
  ): string {
    let message = `El cliente ${customerName} que se encuentra en ${tableInfo}, ha pedido:\n\n`;

    for (const [productName, { price, quantity }] of Object.entries(
      orderChanges,
    )) {
      message += `• ${productName}: $${price.toFixed(2)} x ${quantity} = $${(price * quantity).toFixed(2)}\n`;
    }

    return message.trim();
  }

  private isBillConfirmation(
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
      'perfecto',
      'de acuerdo',
      'exacto',
    ];

    const clientLower = clientMessage.toLowerCase();
    const responseLower = assistantResponse.toLowerCase();

    const clientContainsConfirmation = confirmationKeywords.some((keyword) =>
      clientLower.includes(keyword),
    );

    // Verificar si la respuesta contiene confirmación final de cuenta (nuevo prompt optimizado)
    const responseContainsFinalConfirmation =
      responseLower.includes(
        'en unos momentos se acercará alguien de nuestro personal para apoyarte con el pago',
      ) ||
      responseLower.includes('gracias por tu preferencia') ||
      responseLower.includes('gracias por tu pedido') ||
      responseLower.includes('tu orden está confirmada');

    return clientContainsConfirmation && responseContainsFinalConfirmation;
  }

  private isInitialOrderConfirmation(assistantResponse: string): boolean {
    const responseLower = assistantResponse.toLowerCase();

    // Detecta cuando el cliente confirma su pedido inicial (nuevo prompt optimizado)
    return (
      responseLower.includes(
        'perfecto, gracias por confirmar, tu pedido está ahora en proceso',
      ) || responseLower.includes('tu pedido está ahora en proceso')
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

    // AI responde preguntando por más productos (nuevo prompt optimizado)
    const aiAsksForMore =
      responseLower.includes(
        'es correcta la orden o te gustaría agregar algo más',
      ) ||
      responseLower.includes('te gustaría agregar algo más') ||
      responseLower.includes('hay algo más que te gustaría ordenar') ||
      responseLower.includes('algo más que pueda ayudarte');

    return clientConfirms && aiAsksForMore;
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

      // Obtener historial de conversación (limitado a últimos 20 mensajes para performance)
      const history = await this.conversationService.getConversationHistory(
        conversation.conversationId,
        20,
      );

      // Encontrar el último mensaje del asistente que contiene productos
      let productMessage: string | null = null;
      for (let i = history.length - 1; i >= 0; i--) {
        const message = history[i];
        if (
          message.role === 'assistant' &&
          message.content.includes('• ') && // Debe tener productos en formato bullet
          (message.content.includes('He agregado') ||
            message.content.includes('He actualizado') ||
            message.content.includes('Aquí tienes'))
        ) {
          productMessage = message.content;
          break;
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

      const message = this.generateCashierMessage(
        customer.name,
        tableInfo,
        orderChanges,
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
      
      // Obtener historial como fallback si no hay orden guardada
      const history = await this.conversationService.getConversationHistory(
        conversation.conversationId,
        30, // Limitar búsqueda
      );

      // Encontrar el último mensaje del asistente que contiene la cuenta
      let billMessage: string | null = null;
      for (let i = history.length - 1; i >= 0; i--) {
        const message = history[i];
        if (
          message.role === 'assistant' &&
          (message.content.includes('Aquí tienes tu cuenta:') || // Formato de cuenta
            (message.content.includes('cuenta') &&
              message.content.includes('• ') &&
              message.content.includes('Total')))
        ) {
          billMessage = message.content;
          break;
        }
      }

      if (!billMessage) {
        this.logger.warn('Could not find bill message in conversation history');
        return;
      }

      const tableInfo = await this.extractTableInfoFromConversation(
        conversation.conversationId,
      );

      const cashierMessage = `El cliente ${customer.name} en ${tableInfo}, ha confirmado su cuenta y está listo para pagar.`;

      await this.sendMessage(
        branch.phoneNumberReception,
        cashierMessage,
        branch.phoneNumberAssistant,
      );

      await this.branchService.updateAvailableMessages(branch);

      // Crear orden usando el mensaje que contiene los productos de la cuenta
      await this.createOrderFromBillRequest(billMessage, customer.id, branch);

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

  private async createOrderFromBillRequest(
    assistantResponse: string,
    customerId: string,
    branch: Branch,
  ) {
    try {
      this.logger.log('Creating order from bill request...');
      this.logger.debug(`Assistant response: ${assistantResponse}`);
      
      const orderItems = this.extractOrderFromResponse(assistantResponse);

      if (!orderItems || Object.keys(orderItems).length === 0) {
        this.logger.error(
          'No order items found in assistant response for bill request',
        );
        this.logger.debug(`Response text was: ${assistantResponse}`);
        return;
      }

      this.logger.log(`Extracted ${Object.keys(orderItems).length} items from response`);

      const products = await this.productsService.findAllByRestaurant(
        branch.restaurantId,
        { limit: 100 },
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

      for (const [productName, orderItem] of Object.entries(orderItems)) {
        this.logger.debug(`Processing product: "${productName}" - Price: $${orderItem.price} - Quantity: ${orderItem.quantity}`);
        
        const product = products.products.find(
          (p) =>
            p.name.toLowerCase() === productName.toLowerCase().trim() ||
            p.normalizedName.toLowerCase() === productName.toLowerCase().trim(),
        );

        if (!product) {
          this.logger.warn(`Product not found in database: "${productName}"`);
          continue;
        }

        const menuItem = menuItems.find((m) => m.productId === product.id);

        if (!menuItem) {
          this.logger.warn(`Menu item not found for product: "${productName}" (ID: ${product.id})`);
          continue;
        }

        for (let i = 0; i < orderItem.quantity; i++) {
          await this.orderService.addOrderItem(
            order.order.id,
            {
              menuItemId: menuItem.id,
              price: orderItem.price,
            },
            'es',
          );

          totalAmount += orderItem.price;
          itemsAdded++;
        }
      }

      this.logger.log(`Added ${itemsAdded} items to order. Total: $${totalAmount}`);

      await this.orderService.updateOrder(
        order.order.id,
        { total: totalAmount },
        'es',
      );

      this.logger.log(
        `Order created successfully from bill request: ${order.order.id}, Total: $${totalAmount}`,
      );

      return order.order;
    } catch (error) {
      this.logger.error('Error creating order from bill request:', error);
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
}
