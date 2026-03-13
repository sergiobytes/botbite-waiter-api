import { Injectable, Logger } from '@nestjs/common';
import { MenusService } from '../../../menus/menus.service';

@Injectable()
export class GenerateCashierMessageUseCase {
  private readonly logger = new Logger(GenerateCashierMessageUseCase.name);

  constructor(
    private readonly menusService: MenusService
  ) { }

  async execute(
    customerName: string,
    menuId: string,
    orderChanges: Record<string, { price: number; quantity: number; menuItemId: string; notes?: string }>,
    tableInfo: string,
    amenities?: Record<string, number>): Promise<string> {


    this.logger.log('\n=== GENERATING CASHIER MESSAGE ===');
    this.logger.log(`Customer: ${customerName}`);
    this.logger.log(`Table: ${tableInfo}`);
    this.logger.log(`Products to notify: ${Object.keys(orderChanges).length}`);
    if (amenities) this.logger.log(`Amenities: ${JSON.stringify(amenities)}`);



    let message = '';

    // Si hay productos, usar el formato normal
    if (Object.keys(orderChanges).length > 0) {
      message = `🛎️ El cliente ${customerName} que se encuentra en ${tableInfo}, ha pedido:\n\n`;
    } else if (amenities && Object.keys(amenities).length > 0) {
      // Si solo hay amenidades (sin productos), usar formato diferente
      message = `🍴 El cliente ${customerName} en ${tableInfo} solicita:\n\n`;
    }

    const { items } = await this.menusService.findMenuItems(menuId, { limit: 200 }, {}, 'es',);

    for (const [
      productKey,
      { price, quantity, menuItemId, notes },
    ] of Object.entries(orderChanges)) {
      const productName = productKey.split('||')[0];

      this.logger.log(`\nProduct: ${productName}`);
      this.logger.log(`  menuItemId: ${menuItemId}`);
      this.logger.log(`  price: $${price}`);
      this.logger.log(`  quantity: ${quantity}`);

      let categoryInfo = '';

      const menuItem = items.find((item) => item.id === menuItemId);
      categoryInfo = `(${menuItem?.category.name})`;

      this.logger.log(`  category: ${menuItem?.category.name}`);
      this.logger.log(`  menuItem found: ${!!menuItem}`);

      message += `• ${productName}${categoryInfo}: $${price.toFixed(2)} x ${quantity} = $${(price * quantity).toFixed(2)}`;

      if (notes) message += ` [Nota: ${notes}]`;

      message += `\n`;
    }

    // Agregar amenidades si existen
    if (amenities && Object.keys(amenities).length > 0) {
      message += `\n🍴 Amenidades solicitadas:\n`;
      for (const [amenity, quantity] of Object.entries(amenities)) {
        message += `• ${amenity}: ${quantity}\n`;
      }
    }

    this.logger.log(`\n=== FINAL CASHIER MESSAGE ===\n${message}\n=== END MESSAGE ===\n`);

    return message.trim();
  };
}