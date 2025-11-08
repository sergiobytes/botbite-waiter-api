import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { Repository } from 'typeorm';
import { OrderItem } from './entities/order-item.entity';
import { TranslationService } from '../common/services/translation.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateOrderItemDto } from './dto/create-order-item.dto';

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

  async findAllOrders(branchId: string, lang: string) {
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
    order.total = order.orderItems.reduce((sum, item) => sum + item.price, 0);

    await this.orderRepository.save(order);

    this.logger.log(`Order closed: ${order.id}`);
    return {
      message: this.translationService.translate('orders.order_closed', lang),
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

  async removeOrderItem(orderId: string, itemId: string, lang: string) {
    const orderItem = await this.orderItemRepository.findOne({
      where: { id: itemId, orderId },
    });

    if (!orderItem) {
      this.logger.warn(
        `Delete failed - Order item not found: ${itemId} in order: ${orderId}`,
      );
      throw new NotFoundException(
        this.translationService.translate('orders.orderitem_not_found', lang),
      );
    }

    await this.orderItemRepository.delete(itemId);

    this.logger.log(`Order item deleted: ${itemId} from order: ${orderId}`);
    return {
      message: this.translationService.translate(
        'orders.orderitem_deleted',
        lang,
      ),
    };
  }
}
