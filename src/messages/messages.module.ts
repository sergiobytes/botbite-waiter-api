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

@Module({
  imports: [
    BranchesModule,
    CustomersModule,
    CommonModule,
    OpenAIModule,
    OrdersModule,
    ProductsModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService, TwilioService],
  exports: [MessagesService, TwilioService],
})
export class MessagesModule {}
