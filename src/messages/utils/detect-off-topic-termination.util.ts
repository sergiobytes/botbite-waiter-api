/**
 * Detecta si la respuesta del bot es un mensaje de terminación cortés
 * por persistencia del cliente en conversación fuera de contexto
 */
export const detectOffTopicTerminationUtil = (botResponse: string): boolean => {
  const lowerResponse = botResponse.toLowerCase().trim();

  // Frases clave del mensaje de terminación cortés en diferentes idiomas
  const terminationPhrases = [
    // Español
    'si más adelante necesitas hacer un pedido',
    'estaré disponible para ayudarte',
    'que tengas un excelente día',

    // Inglés
    'if you need to place an order or check the menu later',
    "i'll be available to help you",
    'have a great day',

    // Francés
    'si vous avez besoin de passer une commande',
    'je serai disponible pour vous aider',
    'passez une excellente journée',
  ];

  // Si contiene al menos 2 de las frases de terminación, es un mensaje de terminación
  const matchCount = terminationPhrases.filter((phrase) =>
    lowerResponse.includes(phrase),
  ).length;

  return matchCount >= 2;
};
