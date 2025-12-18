import { Logger } from '@nestjs/common';

export const extractOrderFromResponseUtil = (
  response: string,
  logger?: Logger,
): Record<
  string,
  { price: number; quantity: number; menuItemId: string; notes?: string }
> => {
  const order: Record<
    string,
    { price: number; quantity: number; menuItemId: string; notes?: string }
  > = {};

  if (logger) {
    logger.log('\n=== EXTRACTING ORDER FROM RESPONSE ===');
    logger.log(`Response length: ${response.length} chars`);
  }

  // Buscar la sección de "pedido completo" en varios idiomas
  const completeOrderSectionRegex = /(tu pedido completo:|pedido actual:|pedido completo:|your complete order:|current order:|complete order:|votre commande complète:|commande actuelle:|commande complète:|전체 주문:|현재 주문:)(.*?)(?=\n\n(?:Total|Subtotal)|$)/is;
  const completeOrderMatch = response.match(completeOrderSectionRegex);
  
  let textToExtract = response;
  
  if (completeOrderMatch) {
    // Encontramos la sección de pedido completo, extraer solo de ahí
    textToExtract = completeOrderMatch[0];
    if (logger) {
      logger.log('✅ Found "complete order" section, extracting from there');
      logger.log(`Section length: ${textToExtract.length} chars`);
    }
  } else {
    if (logger) {
      logger.log('ℹ️ No "complete order" section found, extracting from entire response');
    }
  }

  const orderRegex =
    /[•-]\s*\[ID:([^\]]+)\]\s+([^:]+?)\s+\(([^)]+)\)\s*:\s*\$(\d+(?:\.\d{2})?)(?:\s*x\s*(\d+)(?:\s*=\s*\$(\d+(?:\.\d{2})?))?)?(?:\s*\[Nota:\s*([^\]]+)\])?/gi;

  let match;
  let matchCount = 0;

  while ((match = orderRegex.exec(textToExtract)) !== null) {
    matchCount++;
    if (logger) {
      logger.log(`\nMatch ${matchCount}:`);
      logger.log(`  Full match: ${match[0]}`);
    }
    
    const menuItemId = match[1]?.trim();
    const fullName = match[2]?.trim().replace(/\*\*/g, '').trim();
    const price = parseFloat(match[4]);
    const quantity = match[5] ? parseInt(match[5]) : 1;
    const notes = match[7]?.trim();

    if (logger) {
      logger.log(`  menuItemId: ${menuItemId}`);
      logger.log(`  fullName: ${fullName}`);
      logger.log(`  price: ${price}`);
      logger.log(`  quantity: ${quantity}`);
      logger.log(`  notes: ${notes || 'none'}`);
    }

    const lowerName = fullName.toLowerCase();

    if (
      lowerName === 'total' ||
      lowerName.includes('total:') ||
      lowerName.startsWith('total') ||
      lowerName.includes('subtotal') ||
      lowerName.length === 0
    ) {
      if (logger) logger.log(`  ⚠️ SKIPPED (total/subtotal)`);
      continue;
    }

    const orderKey = notes ? `${fullName}||${notes}` : fullName;

    if (order[orderKey]) {
      if (logger) logger.log(`  ℹ️ Adding to existing quantity: ${order[orderKey].quantity} + ${quantity}`);
      order[orderKey].quantity += quantity;
    } else {
      if (logger) logger.log(`  ✅ Adding new product to order`);
      order[orderKey] = { price, quantity, menuItemId, notes };
    }
  }
  
  if (logger) {
    logger.log(`\nTotal matches found: ${matchCount}`);
    logger.log(`Total unique products: ${Object.keys(order).length}`);
    logger.log('=== END EXTRACTION ===\n');
  }
  
  return order;
};
