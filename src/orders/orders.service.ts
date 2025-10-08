import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { Repository } from 'typeorm';
import { OrderItem } from './entities/order-item.entity';
import { TranslationService } from '../common/services/translation.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

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
    const order = this.orderRepository.create({
      ...createOrderDto,
      orderItems: createOrderDto.orderItems,
    });

    const savedOrder = await this.orderRepository.save(order);

    this.logger.log(`Order created: ${savedOrder.id}`);
    return {
      order: savedOrder,
      message: this.translationService.translate('orders.order_created', lang),
    };
  }

  async findAllOrders(lang: string, branchId?: string) {
    const where = branchId ? { branchId } : {};

    const orders = await this.orderRepository.find({
      where,
      relations: { orderItems: true },
    });

    return {
      orders,
      message: this.translationService.translate('orders.orders_found', lang),
    };
  }

  async findOneOrder(id: string, lang: string) {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: { orderItems: true },
    });

    if (!order) {
      this.logger.warn(`Order not found: ${id}`);
      throw new NotFoundException(
        this.translationService.translate('orders.order_not_found', lang),
      );
    }

    return {
      order,
      message: this.translationService.translate('orders.order_found', lang),
    };
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

  async closeOrder(id: string, lang: string) {
    const { order } = await this.findOneOrder(id, lang);

    order.isActive = false;
    order.closedAt = new Date();
    order.total = order.orderItems.reduce((sum, item) => sum + item.price, 0);

    await this.orderRepository.save(order);

    this.logger.log(`Order closed: ${order.id}`);
    return {
      message: this.translationService.translate('orders.order_closed', lang),
    };
  }
}
