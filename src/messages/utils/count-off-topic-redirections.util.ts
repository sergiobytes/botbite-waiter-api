/**
 * Cuenta cuántas veces el bot ha enviado el mensaje de redirección por conversación fuera de contexto
 * CONSECUTIVAMENTE (desde la última interacción válida del cliente)
 */
export const countOffTopicRedirectionsUtil = (
  conversationHistory: Array<{ role: string; content: string }>,
): number => {
  let count = 0;

  // Recorrer el historial en orden (del más antiguo al más reciente)
  for (const message of conversationHistory) {
    if (message.role === 'assistant') {
      const lowerContent = message.content.toLowerCase();

      // Detectar el mensaje de redirección en diferentes idiomas
      const isRedirection =
        lowerContent.includes(
          'gracias por tu interés, pero soy un asistente especializado',
        ) ||
        lowerContent.includes(
          "thank you for your interest, but i'm a specialized assistant",
        ) ||
        lowerContent.includes(
          'merci de votre intérêt, mais je suis un assistant spécialisé',
        );

      if (isRedirection) {
        count++;
      } else {
        // Si es un mensaje del bot que NO es redirección
        // Y parece ser una respuesta válida del restaurante (contiene productos, menú, etc.)
        const isValidRestaurantResponse =
          lowerContent.includes('[id:') || // Tiene productos
          lowerContent.includes('categoría') ||
          lowerContent.includes('category') ||
          lowerContent.includes('menú') ||
          lowerContent.includes('menu') ||
          lowerContent.includes('pedido') ||
          lowerContent.includes('order') ||
          lowerContent.includes('total') ||
          lowerContent.includes('cuenta') ||
          lowerContent.includes('bill');

        // Si es una respuesta válida del restaurante, reiniciar contador
        if (isValidRestaurantResponse) {
          count = 0;
        }
      }
    }
  }

  return count;
};
