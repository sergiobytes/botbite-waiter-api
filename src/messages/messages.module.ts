import {
  forwardRef,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchesModule } from '../branches/branches.module';
import { CommonModule } from '../common/common.module';
import { CustomJwtModule } from '../custom-jwt/custom-jwt.module';
import { CustomersModule } from '../customers/customers.module';
import { MenusModule } from '../menus/menus.module';
import { OpenAIModule } from '../openai/openai.module';
import { OrdersModule } from '../orders/orders.module';
import { QueueModule } from '../queue/queue.module';
import { TemplatesModule } from '../templates/templates.module';
import { ConversationMessage } from './entities/conversation-message.entity';
import { Conversation } from './entities/conversation.entity';
import { OrdersGateway } from './gateways/orders.gateway';
import { MessagesController } from './messages.controller';
import { RateLimitMiddleware } from './middlewares/rate-limit.middleware';
import { ConversationCleanupService } from './services/conversation-cleanup.service';
import { ConversationService } from './services/conversation.service';
import { MessagesService } from './services/messages.service';
import { TwilioService } from './services/twilio.service';
import { CleanupOldConversationsUseCase } from './use-cases/conversations/cleanup-old-conversations.usecase';
import { DeleteConversationUseCase } from './use-cases/conversations/delete-conversation.usecase';
import { FindConversationsByBranchUseCase } from './use-cases/conversations/find-conversations-by-branch.usecase';
import { GetOrCreateConversationUseCase } from './use-cases/conversations/get-create-conversation.usecase';
import { UpdateConversationLocationUseCase } from './use-cases/conversations/update-conversation-location.usecase';
import { UpdateLastOrderSentToCashierUseCase } from './use-cases/conversations/update-last-order-sent-cashier.usecase';
import { DetectOrderActionUseCase } from './use-cases/messages/detect-order-action.usecase';
import { DetectTemplateResponseUseCase } from './use-cases/messages/detect-template-response.usecase';
import { GetConversationHistoryUseCase } from './use-cases/messages/get-conversation-history.usecase';
import { NotifyCashierAboutConfirmedBillUseCase } from './use-cases/messages/notifications/notify-cashier-about-confirmed-bill.usecase';
import { ProcessIncomingMessageUseCase } from './use-cases/messages/process-incoming-message.usecase';
import { ProcessMessageUseCase } from './use-cases/messages/process-message.usecase';
import { RenderOrderResponseUseCase } from './use-cases/messages/render-order-response.usecase';
import { SaveMessageUseCase } from './use-cases/messages/save-message.usecase';
import { ProcessIncomingWhatsappMessageUseCase } from './use-cases/twilio/process-incoming-whatsapp-message.usecase';
import { SendWhatsappMessageUseCase } from './use-cases/twilio/send-whatsapp-message.usecase';
import { NotifyCashierAboutConfirmedProductsUseCase } from './use-cases/messages/notifications/notify-cashier-about-confirmed-products.usecase';
import { NotifyCashierAboutInappropriateBehaviorUseCase } from './use-cases/messages/notifications/notify-cashier-about-inappropriate-behavior.usecase';
import { SendMessageUseCase } from './use-cases/messages/send-message.usecase';
import { CreateOrderAfterBillRequestUseCase } from './use-cases/messages/create-order-after-bill-request.usecase';
import { GenerateCashierMessageUseCase } from './use-cases/messages/generate-cashier-message.usecase';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    BranchesModule,
    CustomersModule,
    CommonModule,
    OpenAIModule,
    OrdersModule,
    MenusModule,
    CustomJwtModule,
    TemplatesModule,
    forwardRef(() => QueueModule),
    TypeOrmModule.forFeature([Conversation, ConversationMessage]),
  ],
  controllers: [MessagesController],
  providers: [
    // Services
    MessagesService,
    TwilioService,
    ConversationService,
    ConversationCleanupService,
    // Gateways
    OrdersGateway,
    // Middlewares
    RateLimitMiddleware,
    // Use Cases
    GetOrCreateConversationUseCase,
    GetConversationHistoryUseCase,
    ProcessMessageUseCase,
    UpdateLastOrderSentToCashierUseCase,
    UpdateConversationLocationUseCase,
    FindConversationsByBranchUseCase,
    DeleteConversationUseCase,
    ProcessIncomingMessageUseCase,
    ProcessIncomingWhatsappMessageUseCase,
    SendWhatsappMessageUseCase,
    CleanupOldConversationsUseCase,
    DetectTemplateResponseUseCase,
    DetectOrderActionUseCase,
    RenderOrderResponseUseCase,
    SaveMessageUseCase,
    NotifyCashierAboutConfirmedBillUseCase,
    NotifyCashierAboutConfirmedProductsUseCase,
    NotifyCashierAboutInappropriateBehaviorUseCase,
    SendMessageUseCase,
    CreateOrderAfterBillRequestUseCase,
    GenerateCashierMessageUseCase
  ],
  exports: [TypeOrmModule, MessagesService, TwilioService, ConversationService],
})
export class MessagesModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RateLimitMiddleware).forRoutes(MessagesController);
  }
}
