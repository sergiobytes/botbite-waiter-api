import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { TwilioService } from './services/twilio/twilio.service';
import { BranchesModule } from '../branches/branches.module';
import { CustomersModule } from '../customers/customers.module';
import { OpenAIModule } from '../openai/openai.module';
import { CommonModule } from '../common/common.module';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';
import { ConversationService } from './services/conversation/conversation.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationMessage } from './entities/conversation-message.entity';

@Module({
  imports: [
    BranchesModule,
    CustomersModule,
    CommonModule,
    OpenAIModule,
    OrdersModule,
    ProductsModule,
    TypeOrmModule.forFeature([Conversation, ConversationMessage]),
  ],
  controllers: [MessagesController],
  providers: [MessagesService, TwilioService, ConversationService],
  exports: [TypeOrmModule, MessagesService, TwilioService, ConversationService],
})
export class MessagesModule {}
