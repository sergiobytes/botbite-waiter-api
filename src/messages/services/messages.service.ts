import { Injectable, Logger } from '@nestjs/common';
import { WebhookDataTwilio } from '../models/webhook-data.twilio';
import { TwilioService } from './twilio.service';
import { BranchesService } from '../../branches/branches.service';
import { CustomersService } from '../../customers/customers.service';
import { TranslationService } from '../../common/services/translation.service';
import { OrdersService } from '../../orders/orders.service';
import { ConversationService } from './conversation.service';
import { MenusService } from '../../menus/menus.service';
import { processIncomingMessageUseCase } from '../use-cases/messages/process-incoming-message.use-case';

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

  async processIncomingMessage(body: WebhookDataTwilio): Promise<void> {
    return processIncomingMessageUseCase({
      body,
      branchesService: this.branchService,
      conversationService: this.conversationService,
      customersService: this.customerService,
      logger: this.logger,
      menuService: this.menusService,
      ordersService: this.orderService,
      twilioService: this.twilioService,
      translationService: this.translationService,
    });
  }
}
