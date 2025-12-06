import { Order } from '../../../orders/entities/order.entity';
import { CreateOrderFromLastOrder } from '../../../messages/interfaces/messages.interfaces';

export const createOrderAfterBillRequestUseCase = async (
  params: CreateOrderFromLastOrder,
): Promise<Order | undefined> => {
  const { branch, customerId, orderItems, service, logger } = params;

  try {
    logger.log('Creating order from lastOrderSentToCashier...');

    if (!orderItems || Object.keys(orderItems).length === 0) {
      logger.error('No order items in lastOrderSentToCashier');
      return;
    }

    logger.log(
      `Processing ${Object.keys(orderItems).length} items from lastOrderSentToCashier`,
    );

    if (!branch.menus || branch.menus.length === 0) {
      logger.warn('No menus found for branch');
      return;
    }

    const menuItems = branch.menus[0].menuItems;

    const { order } = await service.createOrder(
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
        logger.warn(
          `No menuItemId provided for product: "${productName}". Skipping.`,
        );
        continue;
      }

      const menuItem = menuItems.find((m) => m.id === orderItem.menuItemId);

      if (!menuItem) {
        logger.warn(
          `Menu item not found by ID: ${orderItem.menuItemId} for product "${productName}"`,
        );
        continue;
      }

      for (let i = 0; i < orderItem.quantity; i++) {
        await service.addOrderItem(
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

    logger.log(`Added ${itemsAdded} items to order. Total: $${totalAmount}`);

    await service.updateOrder(order.id, { total: totalAmount }, 'es');

    logger.log(
      `Order created successfully from lastOrderSentToCashier: ${order.id}, Total: $${totalAmount}`,
    );

    return order;
  } catch (error) {
    logger.error('Error creating order from lastOrderSentToCashier:', error);
    throw error;
  }
};
