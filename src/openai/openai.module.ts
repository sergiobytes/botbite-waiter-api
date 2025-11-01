import { Module } from '@nestjs/common';
import { OpenAIService } from './services/openai.service';
import { AssistantService } from './assistant.service';
import { MenusModule } from '../menus/menus.module';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [MenusModule, ProductsModule, OrdersModule],
  providers: [OpenAIService, AssistantService],
  exports: [OpenAIService, AssistantService],
})
export class OpenAIModule {}
