import { GenerateCashierMessage } from '../../interfaces/messages.interfaces';

export const generateCashierMessageUseCase = async (
  params: GenerateCashierMessage,
): Promise<string> => {
  const { customerName, menuId, orderChanges, tableInfo, service } = params;

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

    let categoryInfo = '';

    const menuItem = items.find((item) => item.id === menuItemId);
    categoryInfo = `(${menuItem?.category.name})`;

    message += `• ${productName}${categoryInfo}: $${price.toFixed(2)} x ${quantity} = $${(price * quantity).toFixed(2)}`;

    if (notes) message += ` [Nota: ${notes}]`;

    message += `\n`;
  }

  return message.trim();
};
