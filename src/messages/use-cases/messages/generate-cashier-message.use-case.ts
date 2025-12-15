import { GenerateCashierMessage } from '../../interfaces/messages.interfaces';

export const generateCashierMessageUseCase = async (
  params: GenerateCashierMessage,
): Promise<string> => {
  const { customerName, menuId, orderChanges, tableInfo, service, logger } = params;

  if (logger) {
    logger.log('\n=== GENERATING CASHIER MESSAGE ===');
    logger.log(`Customer: ${customerName}`);
    logger.log(`Table: ${tableInfo}`);
    logger.log(`Products to notify: ${Object.keys(orderChanges).length}`);
  }

  let message = `🛎️ El cliente ${customerName} que se encuentra en ${tableInfo}, ha pedido:\n\n`;

  const { items } = await service.findMenuItems(
    menuId,
    { limit: 200 },
    {},
    'es',
  );

  for (const [
    productKey,
    { price, quantity, menuItemId, notes },
  ] of Object.entries(orderChanges)) {
    const productName = productKey.split('||')[0];

    if (logger) {
      logger.log(`\nProduct: ${productName}`);
      logger.log(`  menuItemId: ${menuItemId}`);
      logger.log(`  price: $${price}`);
      logger.log(`  quantity: ${quantity}`);
    }

    let categoryInfo = '';

    const menuItem = items.find((item) => item.id === menuItemId);
    categoryInfo = `(${menuItem?.category.name})`;

    if (logger) {
      logger.log(`  category: ${menuItem?.category.name}`);
      logger.log(`  menuItem found: ${!!menuItem}`);
    }

    message += `• ${productName}${categoryInfo}: $${price.toFixed(2)} x ${quantity} = $${(price * quantity).toFixed(2)}`;

    if (notes) message += ` [Nota: ${notes}]`;

    message += `\n`;
  }

  if (logger) {
    logger.log(`\n=== FINAL CASHIER MESSAGE ===\n${message}\n=== END MESSAGE ===\n`);
  }

  return message.trim();
};
