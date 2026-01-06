import {
  forwardRef,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MessagesService } from './services/messages.service';
import { MessagesController } from './messages.controller';
import { TwilioService } from './services/twilio.service';
import { BranchesModule } from '../branches/branches.module';
import { CustomersModule } from '../customers/customers.module';
import { OpenAIModule } from '../openai/openai.module';
import { CommonModule } from '../common/common.module';
import { OrdersModule } from '../orders/orders.module';
import { ConversationService } from './services/conversation.service';
import { ConversationCleanupService } from './services/conversation-cleanup.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationMessage } from './entities/conversation-message.entity';
import { MenusModule } from '../menus/menus.module';
import { CustomJwtModule } from '../custom-jwt/custom-jwt.module';
import { OrdersGateway } from './gateways/orders.gateway';
import { QueueModule } from '../queue/queue.module';
import { RateLimitMiddleware } from './middlewares/rate-limit.middleware';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BranchesModule,
    CustomersModule,
    CommonModule,
    OpenAIModule,
    OrdersModule,
    MenusModule,
    CustomJwtModule,
    forwardRef(() => QueueModule),
    TypeOrmModule.forFeature([Conversation, ConversationMessage]),
  ],
  controllers: [MessagesController],
  providers: [
    MessagesService,
    TwilioService,
    ConversationService,
    ConversationCleanupService,
    OrdersGateway,
    RateLimitMiddleware,
  ],
  exports: [TypeOrmModule, MessagesService, TwilioService, ConversationService],
})
export class MessagesModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RateLimitMiddleware).forRoutes('messages/webhook');
  }
}
