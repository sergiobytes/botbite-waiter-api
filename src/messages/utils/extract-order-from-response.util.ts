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

  const orderRegex =
    /[•-]\s*\[ID:([^\]]+)\]\s+([^:]+?)\s+\(([^)]+)\)\s*:\s*\$(\d+(?:\.\d{2})?)(?:\s*x\s*(\d+)(?:\s*=\s*\$(\d+(?:\.\d{2})?))?)?(?:\s*\[Nota:\s*([^\]]+)\])?/gi;

  let match;
  let matchCount = 0;

  if (logger) {
    logger.log('\n=== EXTRACTING ORDER FROM RESPONSE ===');
    logger.log(`Response length: ${response.length} chars`);
  }

  while ((match = orderRegex.exec(response)) !== null) {
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
