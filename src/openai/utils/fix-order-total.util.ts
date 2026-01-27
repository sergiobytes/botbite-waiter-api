import { Logger } from '@nestjs/common';

/**
 * Extrae productos del mensaje del bot y calcula el total correcto
 * Solo cuenta productos de la sección "Tu pedido completo:" para evitar duplicados
 * Usa Map con ID del producto para eliminar duplicados
 * Calcula el total sumando todos los subtotales únicos
 * Reemplaza "Total:" o "Total actualizado:" en la respuesta con el total correcto
 */
export const fixOrderTotalUtil = (response: string, logger: Logger): string => {
  try {
    // Buscar si el mensaje contiene "Total:" o "Total actualizado:"
    if (!response.match(/Total( actualizado)?:\s*\$[\d,]+\.?\d*/i)) {
      // No hay total que corregir
      return response;
    }

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
    const correctTotal = Array.from(productsMap.values()).reduce(
      (sum, subtotal) => sum + subtotal,
      0,
    );

    logger.log(
      `Fixing total: Found ${productsMap.size} unique products, correct total: $${correctTotal.toFixed(2)}`,
    );

    // Reemplazar "Total:" o "Total actualizado:" con el total correcto
    const totalRegex = /Total( actualizado)?:\s*\$([\d,]+\.?\d*)/gi;

    const fixedResponse = response.replace(totalRegex, (match, actualizado) => {
      const prefix = actualizado ? 'Total actualizado' : 'Total';
      return `${prefix}: $${correctTotal.toFixed(2)}`;
    });

    return fixedResponse;
  } catch (error) {
    logger.error('Error fixing order total:', error);
    // En caso de error, devolver la respuesta original
    return response;
  }
};
