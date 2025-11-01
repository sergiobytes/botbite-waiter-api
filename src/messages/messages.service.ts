import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { WebhookDataTwilio } from './models/webhook-data.twilio';
import { TwilioService } from './services/twilio/twilio.service';
import { BranchesService } from '../branches/branches.service';
import { Customer } from '../customers/entities/customer.entity';
import { CustomersService } from '../customers/customers.service';
import { TranslationService } from '../common/services/translation.service';
import { AssistantService } from '../openai/assistant.service';
import { Branch } from '../branches/entities/branch.entity';
import { ProductsService } from '../products/products.service';
import { extractOrderDataFromMessage } from '../common/utils/extract-order-data-from-message';
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
    private readonly assistantService: AssistantService,
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

    // Validate branch balance

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
        threadId: undefined,
      };
    }

    const response = await this.conversationService.processMessage(
      messageData.from,
      messageData.message,
      branch.id,
      customer,
      branch,
    );

    // Enviar respuesta al cliente
    await this.sendMessage(
      customer.phone,
      response,
      branch.phoneNumberAssistant,
    );

    // Si el pedido fue confirmado, notificar al cajero
    if (response.includes('Tu pedido está ahora en proceso')) {
      await this.notifyCashierAboutOrder(
        messageData.from,
        response,
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

  private async notifyCashierAboutOrder(
    customerPhone: string,
    assistantResponse: string,
    customer: Customer,
    branch: Branch,
  ) {
    try {
      const conversation =
        await this.conversationService.getOrCreateConversation(
          customerPhone,
          branch.id,
        );

      const currentOrder = this.extractOrderFromResponse(assistantResponse);

      if (!currentOrder) {
        this.logger.warn('Could not extract order from assistant response');
        return;
      }

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

      const cashierMessage = this.generateCashierMessage(
        customer.name,
        tableInfo,
        orderChanges,
      );

      await this.sendMessage(
        branch.phoneNumberReception,
        cashierMessage,
        branch.phoneNumberAssistant,
      );

      await this.conversationService.updateLastOrderSentToCashier(
        conversation.conversationId,
        currentOrder,
      );

      this.logger.log(
        `Cashier notification sent for customer ${customer.name}`,
      );
    } catch (error) {
      this.logger.error('Error notifying cashier about order:', error);
    }
  }

  private extractOrderFromResponse(
    response: string,
  ): Record<string, { price: number; quantity: number }> {
    const order: Record<string, { price: number; quantity: number }> = {};

    const orderRegex =
      /[-•]\s*\*?\*?([^:]+):\s*\$(\d+(?:\.\d{2})?)\s*x\s*(\d+)\s*=\s*\$(\d+(?:\.\d{2})?)/g;

    let match;
    while ((match = orderRegex.exec(response)) !== null) {
      const productName = match[1].trim().replace(/\*\*/g, ''); // Remover asteriscos de formato
      const price = parseFloat(match[2]);
      const quantity = parseInt(match[3]);

      order[productName] = { price, quantity };
    }

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
          const content = message.content.toLowerCase();

          const tablePatterns = [
            /mesa\s+(\d+)/,
            /table\s+(\d+)/,
            /^(\d+)$/,
            /(planta\s+\w+\s+mesa\s+\d+)/,
            /(terraza|barra|patio)/,
          ];

          for (const pattern of tablePatterns) {
            const match = content.match(pattern);
            if (match) {
              return match[1] || match[0];
            }
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

  private async saveOrder(
    branch: Branch,
    customerId: string,
    clientMessage: string,
  ) {
    const menuItems = branch.menus[0].menuItems;
    const products = await this.productsService.findAllByRestaurant(
      branch.restaurantId,
      { limit: menuItems.length },
    );

    const parsedOrderData = extractOrderDataFromMessage(clientMessage);

    if (!parsedOrderData) throw new BadRequestException('Invalid order data');

    const order = await this.orderService.createOrder(
      {
        branchId: branch.id,
        customerId,
        orderItems: [],
      },
      'en',
    );

    let total = 0;

    for (const item of parsedOrderData) {
      const product = products.products.find(
        (p) => p.name.toLowerCase() === item.productName.toLowerCase(),
      );

      if (!product) continue;

      const menuItem = menuItems.find((m) => m.productId === product.id);

      if (!menuItem) continue;

      total += menuItem.price * item.quantity;

      await this.orderService.addOrderItem(
        order.order.id,
        {
          menuItemId: menuItem.id,
          price: menuItem.price,
          notes: '',
        },
        'es',
      );
    }

    await this.orderService.updateOrder(order.order.id, { total }, 'es');
  }
}
