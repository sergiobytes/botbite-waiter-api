import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BranchesService } from '../../branches/branches.service';
import { Branch } from '../../branches/entities/branch.entity';
import { TranslationService } from '../../common/services/translation.service';
import { CustomersService } from '../../customers/customers.service';
import { Customer } from '../../customers/entities/customer.entity';
import { MenusService } from '../../menus/menus.service';
import { OpenAIService } from '../../openai/openai.service';
import { ConversationMessage } from '../entities/conversation-message.entity';
import { Conversation } from '../entities/conversation.entity';
import { WebhookDataTwilio } from '../models/webhook-data.twilio';
import { ConversationService } from '../services/conversation.service';
import { TwilioService } from '../services/twilio.service';
import { OrdersService } from '../../orders/orders.service';

export interface SaveMessage {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  repository: Repository<ConversationMessage>;
}

export interface GetConversationHistory {
  conversationId: string;
  repository: Repository<ConversationMessage>;
}

export interface ProcessMessage {
  phoneNumber: string;
  userMessage: string;
  branchId?: string;
  customerContext?: Customer;
  branchContext?: Branch;
  logger: Logger;
  conversationMessageRepository: Repository<ConversationMessage>;
  conversationRepository: Repository<Conversation>;
  service: OpenAIService;
}

export interface ProcessIncomingMessage {
  body: WebhookDataTwilio;
  logger: Logger;
  twilioService: TwilioService;
  branchesService: BranchesService;
  customersService: CustomersService;
  translationService: TranslationService;
  conversationService: ConversationService;
  menuService: MenusService;
  ordersService: OrdersService;
}

export interface SendMessage {
  customerPhone: string;
  message: string;
  assistantPhone: string | null;
  twilioService: TwilioService;
  logger: Logger;
}

export interface NotifyCashier {
  from: string;
  message: string;
  customer: Customer;
  branch: Branch;
  twilioService: TwilioService;
  conversationService: ConversationService;
  menuService: MenusService;
  branchesService: BranchesService;
  ordersService: OrdersService;
  logger: Logger;
  paymentMethod?: string; // 'efectivo', 'tarjeta', o 'no especificado'
}

export interface GenerateCashierMessage {
  customerName: string;
  tableInfo: string;
  orderChanges: Record<
    string,
    { price: number; quantity: number; menuItemId: string; notes?: string }
  >;
  menuId: string;
  service: MenusService;
}

export interface CreateOrderFromLastOrder {
  orderItems: Record<
    string,
    { price: number; quantity: number; menuItemId: string; notes?: string }
  >;
  customerId: string;
  branch: Branch;
  service: OrdersService;
  logger: Logger;
}

export interface ConversationHistoryResponse {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}
