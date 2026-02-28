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
import { DetectOrderActionUseCase } from './use-cases/messages/detect-order-action.use-case';
import { DetectTemplateResponseUseCase } from './use-cases/messages/detect-template-response.use-case';
import { RenderOrderResponseUseCase } from './use-cases/messages/render-order-response.use-case';

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
    DetectTemplateResponseUseCase,
    DetectOrderActionUseCase,
    RenderOrderResponseUseCase,
  ],
  exports: [TypeOrmModule, MessagesService, TwilioService, ConversationService],
})
export class MessagesModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RateLimitMiddleware).forRoutes(MessagesController);
  }
}
