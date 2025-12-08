import { Module } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { MenusModule } from '../menus/menus.module';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [MenusModule, ProductsModule, OrdersModule],
  providers: [OpenAIService],
  exports: [OpenAIService],
})
export class OpenAIModule {}
