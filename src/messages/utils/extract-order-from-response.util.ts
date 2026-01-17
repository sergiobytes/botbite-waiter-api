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
  const completeOrderSectionRegex =
    /(tu pedido completo:|pedido actual:|pedido completo:|your complete order:|current order:|complete order:|votre commande complète:|commande actuelle:|commande complète:|전체 주문:|현재 주문:)(.*?)(?=\n\n(?:Total|Subtotal)|$)/is;
  const completeOrderMatch = response.match(completeOrderSectionRegex);

  // Buscar sección de resumen de cuentas separadas
  const separateAccountsRegex =
    /(ahora,?\s*las cuentas quedan de la siguiente manera:|the accounts are now as follows:|voici les comptes maintenant:)(.*?)$/is;
  const separateAccountsMatch = response.match(separateAccountsRegex);

  let textToExtract = response;

  if (separateAccountsMatch) {
    // Encontramos resumen de cuentas separadas, extraer SOLO desde ahí hasta el final
    textToExtract = separateAccountsMatch[0];
    if (logger) {
      logger.log(
        '✅ Found "separate accounts summary" section, extracting ONLY from there to avoid duplicates',
      );
      logger.log(`Section length: ${textToExtract.length} chars`);
    }
  } else if (completeOrderMatch) {
    // Encontramos la sección de pedido completo, extraer SOLO de ahí
    // Esto evita duplicados cuando el mensaje tiene "He agregado:" seguido de "Tu pedido completo:"
    textToExtract = completeOrderMatch[0];
    if (logger) {
      logger.log(
        '✅ Found "complete order" section, extracting ONLY from there (skipping "He agregado" section to avoid duplicates)',
      );
      logger.log(`Section length: ${textToExtract.length} chars`);
    }
  } else {
    // Si no hay sección "pedido completo", buscar sección "He agregado" para extraer solo de ahí
    const addedSectionRegex =
      /(he agregado:|he actualizado:|i added:|i updated:|j'ai ajouté:|j'ai mis à jour:|추가했습니다:|업데이트했습니다:)(.*?)(?=\n\n(?:Tu pedido completo:|Pedido actual:|Total|Subtotal)|$)/is;
    const addedMatch = response.match(addedSectionRegex);

    if (addedMatch) {
      // Encontramos la sección "He agregado", extraer solo de ahí
      textToExtract = addedMatch[0];
      if (logger) {
        logger.log('✅ Found "He agregado" section, extracting from there');
        logger.log(`Section length: ${textToExtract.length} chars`);
      }
    } else {
      if (logger) {
        logger.log(
          'ℹ️ No "complete order" or "He agregado" section found, extracting from entire response',
        );
      }
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

    // CRITICAL FIX: Don't sum quantities - the "complete order" section already has correct totals
    // If we sum, we get duplicates when GPT lists product in "He agregado" AND "Tu pedido completo"
    if (order[orderKey]) {
      if (logger)
        logger.log(
          `  ⚠️ Product already exists, REPLACING (not summing) with latest value: ${quantity}`,
        );
      // Replace with latest quantity instead of summing
      order[orderKey] = { price, quantity, menuItemId, notes };
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
