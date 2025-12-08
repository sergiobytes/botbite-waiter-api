import { TranslationService } from '../../common/services/translation.service';
import { Repository } from 'typeorm';
import { CreateOrderDto } from '../dto/create-order.dto';
import { Order } from '../entities/order.entity';
import { Logger } from '@nestjs/common';

export interface CreateOrder {
  dto: CreateOrderDto;
  lang: string;
  repository: Repository<Order>;
  logger: Logger;
  translationService: TranslationService;
}

export interface OrderResponse {
  order: Order;
  message: string;
}
