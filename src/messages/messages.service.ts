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

    await this.sendMessage(
      customer.phone,
      response,
      branch.phoneNumberAssistant,
    );
  }

  // async processIncomingMessageOriginal(body: WebhookDataTwilio) {
  //   // Use TwilioService to process the incoming WhatsApp message (BAJA SALDO)
  //   const messageData = this.twilioService.processIncomingWhatsappMessage(body);

  //   // Validate the 'to' number against existing branches
  //   const branch = await this.branchService.findByTerm(messageData.to);

  //   if (!branch) {
  //     throw new NotFoundException(
  //       this.translationService.translate('errors.branch_not_found', 'en'),
  //     );
  //   }

  //   // Validate branch balance

  //   const isAdmin = messageData.from === branch.phoneNumberReception;

  //   let customer: Customer;
  //   let assistantResponse: string | null;
  //   let threadId: string | null;

  //   if (!isAdmin) {
  //     customer = await this.findOrCreateCustomer(
  //       messageData.from,
  //       messageData.profileName,
  //     );
  //   } else {
  //     customer = {
  //       id: 'xxxx',
  //       name: messageData.profileName,
  //       phone: messageData.from,
  //       createdAt: new Date(),
  //       updatedAt: new Date(),
  //       isActive: true,
  //       threadId: undefined,
  //     };
  //   }

  //   if (branch.assistantId) {
  //     const assistantResult = await this.assistantService.processMessage(
  //       branch,
  //       customer,
  //       messageData.message,
  //       customer.threadId,
  //     );

  //     assistantResponse = assistantResult.response;
  //     threadId = assistantResult.threadId;

  //     if (!isAdmin) {
  //       await this.customerService.update(customer.phone, { threadId }, 'en');
  //     }

  //     customer.threadId = threadId;

  //     if (assistantResponse.includes('### CAJA')) {
  //       const { client, cashier } = splitMessages(assistantResponse);

  //       const messages: Promise<MessageInstance>[] = [];

  //       if (client) {
  //         messages.push(
  //           this.sendMessage(
  //             customer.phone,
  //             client,
  //             branch.phoneNumberAssistant,
  //           ),
  //         );
  //       }

  //       for (const block of cashier) {
  //         messages.push(
  //           this.sendMessage(
  //             branch.phoneNumberReception,
  //             block,
  //             branch.phoneNumberAssistant,
  //           ),
  //         );
  //       }

  //       await Promise.all(messages);

  //       // Create Ordeer after client confirmation
  //       if (hasRequestedBill(cashier)) {
  //         await this.saveOrder(branch, customer.id, client!);
  //         await this.customerService.update(
  //           customer.phone,
  //           { threadId: '' },
  //           'en',
  //         );
  //       }
  //     }
  //   }
  // }

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
