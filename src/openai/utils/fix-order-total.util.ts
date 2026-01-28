import { Logger } from '@nestjs/common';

/**
 * Calcula el total correcto del pedido basándose en lastOrderSentToCashier
 * Si lastOrderSentToCashier está disponible, usa ese total (fuente de verdad)
 * Si no está disponible, extrae productos del mensaje y calcula
 * Reemplaza "Total:" o "Total actualizado:" en la respuesta con el total correcto
 */
export const fixOrderTotalUtil = (
  response: string,
  logger: Logger,
  lastOrderSentToCashier?: Record<
    string,
    { price: number; quantity: number; menuItemId: string; notes?: string }
  >,
): string => {
  try {
    // Buscar si el mensaje contiene "Total:" o "Total actualizado:"
    if (!response.match(/Total( actualizado| general)?:\s*\$[\d,]+\.?\d*/i)) {
      // No hay total que corregir
      return response;
    }

    let correctTotal: number;

    // PRIORIDAD 1: Si tenemos lastOrderSentToCashier, calcular desde ahí (fuente de verdad)
    if (
      lastOrderSentToCashier &&
      Object.keys(lastOrderSentToCashier).length > 0
    ) {
      correctTotal = Object.values(lastOrderSentToCashier).reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      logger.log(
        `Calculating total from lastOrderSentToCashier: $${correctTotal.toFixed(2)}`,
      );
    } else {
      // FALLBACK: Calcular desde el mensaje del bot (método antiguo)

      // Primero, intentar extraer solo la sección "Tu pedido completo:" o "Your complete order:"
      // para evitar contar productos duplicados en "He agregado:" / "I added:"
      const completePedidoRegex =
        /(?:Tu pedido completo(?:\s+actualizado)?|Your complete order|Votre commande complète|전체 주문):\s*([\s\S]*?)(?=(?:\r?\n){1,2}Total)/i;
      const completePedidoMatch = response.match(completePedidoRegex);

      let sectionToAnalyze = response;

      if (completePedidoMatch) {
        // Si encontramos la sección "Tu pedido completo", solo analizar esa sección
        sectionToAnalyze = completePedidoMatch[1];
        logger.log(
          'Analyzing only "Tu pedido completo" section to avoid duplicates',
        );
      } else {
        // Si no hay sección de pedido completo, buscar si hay sección "Aquí tienes tu cuenta:"
        const cuentaRegex =
          /(?:Aquí tienes tu cuenta|Here is your bill|Voici votre facture):\s*([\s\S]*?)(?=(?:\r?\n){1,2}Total)/i;
        const cuentaMatch = response.match(cuentaRegex);

        if (cuentaMatch) {
          sectionToAnalyze = cuentaMatch[1];
          logger.log('Analyzing only "Aquí tienes tu cuenta" section');
        } else {
          // Si tampoco hay cuenta, buscar sección "He agregado" hasta "Total"
          const heAgregadoRegex =
            /(?:He agregado(?:\s+a tu pedido| los pedidos)?|I added|J'ai ajouté):\s*([\s\S]*?)(?=(?:\r?\n){1,2}Total)/i;
          const heAgregadoMatch = response.match(heAgregadoRegex);

          if (heAgregadoMatch) {
            sectionToAnalyze = heAgregadoMatch[1];
            logger.log('Analyzing only "He agregado" section');
          } else {
            // Si no hay ninguna sección específica, analizar todo hasta el Total
            const beforeTotalRegex = /([\s\S]*?)(?=(?:\r?\n){1,2}Total)/i;
            const beforeTotalMatch = response.match(beforeTotalRegex);
            if (beforeTotalMatch) {
              sectionToAnalyze = beforeTotalMatch[1];
              logger.log('Analyzing entire message before Total');
            }
          }
        }
      }

      // Regex para extraer productos con formato: • [ID:xxx] NOMBRE (...): $XX.XX x N = $XX.XX
      // Captura: ID, y subtotal
      const productRegex =
        /•\s*\[ID:([^\]]+)\]\s*[^:]+:\s*\$[\d,]+\.?\d+\s*x\s*\d+\s*=\s*\$([\d,]+\.?\d+)/g;

      const productsMap = new Map<string, number>(); // ID -> subtotal
      let match;

      while ((match = productRegex.exec(sectionToAnalyze)) !== null) {
        const productId = match[1];
        const subtotalStr = match[2].replace(/,/g, ''); // Remover comas
        const subtotal = parseFloat(subtotalStr);

        if (!isNaN(subtotal)) {
          // Usar Map para evitar duplicados - último valor gana
          productsMap.set(productId, subtotal);
        }
      }

      // Si no encontramos productos, no hacemos nada
      if (productsMap.size === 0) {
        logger.warn('No products found in response, skipping total fix');
        return response;
      }

      // Calcular el total correcto sumando todos los subtotales únicos
      correctTotal = Array.from(productsMap.values()).reduce(
        (sum, subtotal) => sum + subtotal,
        0,
      );

      logger.log(
        `Fixing total from message: Found ${productsMap.size} unique products, correct total: $${correctTotal.toFixed(2)}`,
      );
    }

    // Reemplazar "Total:" o "Total actualizado:" o "Total general:" con el total correcto
    const totalRegex = /Total( actualizado| general)?:\s*\$([\d,]+\.?\d*)/gi;

    const fixedResponse = response.replace(totalRegex, (match, suffix) => {
      let prefix = 'Total';
      if (suffix) {
        prefix = `Total${suffix}`;
      }
      return `${prefix}: $${correctTotal.toFixed(2)}`;
    });

    return fixedResponse;
  } catch (error) {
    logger.error('Error fixing order total:', error);
    // En caso de error, devolver la respuesta original
    return response;
  }
};
