import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TranslationService } from '../common/services/translation.service';
import { CreateOrderItemDto } from './dto/create-order-item.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { createOrderUseCase } from './use-cases/orders/create-order.use-case';
import { findAllOrdersUseCase } from './use-cases/orders/find-all-orders.use-case';
import { findOneOrderUseCase } from './use-cases/orders/find-one-order.use-case';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    private readonly translationService: TranslationService,
  ) {}

  async createOrder(createOrderDto: CreateOrderDto, lang: string) {
    return createOrderUseCase({
      dto: createOrderDto,
      lang,
      repository: this.orderRepository,
      logger: this.logger,
      translationService: this.translationService,
    });
  }

  async findAllOrders(branchId: string, lang: string) {
    return findAllOrdersUseCase({
      branchId,
      lang,
      repository: this.orderRepository,
      translationService: this.translationService,
    });
  }

  async findOneOrder(id: string, lang: string) {
    return findOneOrderUseCase({
      orderId: id,
      lang,
      repository: this.orderRepository,
      logger: this.logger,
      translationService: this.translationService,
    });
  }

  async updateOrder(id: string, dto: UpdateOrderDto, lang: string) {
    const { order } = await this.findOneOrder(id, lang);

    Object.assign(order, dto);
    const updatedOrder = await this.orderRepository.save(order);

    this.logger.log(`Order updated: ${updatedOrder.id}`);
    return {
      order: updatedOrder,
      message: this.translationService.translate('orders.order_updated', lang),
    };
  }

  async addOrderItem(orderId: string, dto: CreateOrderItemDto, lang: string) {
    const { order } = await this.findOneOrder(orderId, lang);

    const orderItem = this.orderItemRepository.create({
      ...dto,
      orderId: order.id,
    });

    const savedItem = await this.orderItemRepository.save(orderItem);

    this.logger.log(
      `Order item created: ${savedItem.id} for order: ${orderId}`,
    );

    return {
      orderItem: savedItem,
      message: this.translationService.translate(
        'orders.orderitem_created',
        lang,
      ),
    };
  }
}
