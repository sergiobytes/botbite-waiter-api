import { Module } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { MenusModule } from '../menus/menus.module';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';
import { TemplatesModule } from '../templates/templates.module';
import { ProcessOrderWithAIUseCase } from './use-cases/process-order-with-ai.use-case';

@Module({
  imports: [MenusModule, ProductsModule, OrdersModule, TemplatesModule],
  providers: [OpenAIService, ProcessOrderWithAIUseCase],
  exports: [OpenAIService, ProcessOrderWithAIUseCase],
})
export class OpenAIModule { }
