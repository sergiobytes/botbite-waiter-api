import { Order } from '../../../orders/entities/order.entity';
import { Injectable, Logger } from '@nestjs/common';
import { OrdersService } from '../../../orders/orders.service';
import { Branch } from '../../../branches/entities/branch.entity';

@Injectable()
export class CreateOrderAfterBillRequestUseCase {
  private readonly logger = new Logger(CreateOrderAfterBillRequestUseCase.name);

  constructor(
    private readonly ordersService: OrdersService,
  ) { }

  async execute(customerId: string, orderItems: Record<string, { price: number; quantity: number; menuItemId: string; notes?: string }>, branch: Branch): Promise<Order | undefined> {
    try {
      this.logger.log('Creating order from lastOrderSentToCashier...');

      if (!orderItems || Object.keys(orderItems).length === 0) {
        this.logger.error('No order items in lastOrderSentToCashier');
        return;
      }

      this.logger.log(
        `Processing ${Object.keys(orderItems).length} items from lastOrderSentToCashier`,
      );

      if (!branch.menus || branch.menus.length === 0) {
        this.logger.warn('No menus found for branch');
        return;
      }

      const menuItems = branch.menus[0].menuItems;

      const { order } = await this.ordersService.createOrder(
        {
          branchId: branch.id,
          customerId,
          orderItems: [],
        },
        'es',
      );

      let totalAmount = 0;
      let itemsAdded = 0;

      for (const [productKey, orderItem] of Object.entries(orderItems)) {
        const productName = productKey.split('||')[0];

        if (!orderItem.menuItemId) {
          this.logger.warn(
            `No menuItemId provided for product: "${productName}". Skipping.`,
          );
          continue;
        }

        const menuItem = menuItems.find((m) => m.id === orderItem.menuItemId);

        if (!menuItem) {
          this.logger.warn(
            `Menu item not found by ID: ${orderItem.menuItemId} for product "${productName}"`,
          );
          continue;
        }

        for (let i = 0; i < orderItem.quantity; i++) {
          await this.ordersService.addOrderItem(
            order.id,
            {
              menuItemId: menuItem.id,
              price: orderItem.price,
              notes: orderItem.notes,
            },
            'es',
          );

          totalAmount += orderItem.price;
          itemsAdded++;
        }
      }

      this.logger.log(`Added ${itemsAdded} items to order. Total: $${totalAmount}`);

      await this.ordersService.updateOrder(order.id, { total: totalAmount }, 'es');

      this.logger.log(
        `Order created successfully from lastOrderSentToCashier: ${order.id}, Total: $${totalAmount}`,
      );

      return order;
    } catch (error) {
      this.logger.error('Error creating order from lastOrderSentToCashier:', error);
      throw error;
    }
  };
}