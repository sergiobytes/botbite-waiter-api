import { Module } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { MenusModule } from '../menus/menus.module';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [MenusModule, ProductsModule, OrdersModule, TemplatesModule],
  providers: [OpenAIService],
  exports: [OpenAIService],
})
export class OpenAIModule {}
