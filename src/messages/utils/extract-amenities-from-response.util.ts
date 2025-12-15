import { Logger } from '@nestjs/common';

/**
 * Extrae amenidades solicitadas del mensaje del AI
 * Busca patrones como "He agregado a tu solicitud: cubiertos (2), servilletas"
 */
export const extractAmenitiesFromResponseUtil = (
  aiResponse: string,
  logger?: Logger,
): Record<string, number> => {
  const amenities: Record<string, number> = {};
  const responseLower = aiResponse.toLowerCase();

  // Lista de amenidades reconocidas (singular y plural)
  const amenityKeywords = {
    cubiertos: ['cubiertos', 'cubierto', 'tenedores', 'tenedor', 'cuchillos', 'cuchillo', 'cucharas', 'cuchara', 'utensils', 'cutlery', 'fork', 'forks', 'knife', 'knives', 'spoon', 'spoons'],
    servilletas: ['servilletas', 'servilleta', 'napkins', 'napkin'],
    vasos: ['vasos', 'vaso', 'glasses', 'glass', 'cups', 'cup'],
    platos: ['platos', 'plato', 'plates', 'plate', 'dishes', 'dish'],
    popotes: ['popotes', 'popote', 'pajitas', 'pajilla', 'pajita', 'straws', 'straw'],
    sal: ['sal', 'salt'],
    pimienta: ['pimienta', 'pepper'],
    limones: ['limones', 'limon', 'limón', 'limes', 'lime', 'lemons', 'lemon'],
    salsas: ['salsas', 'salsa', 'sauce', 'sauces'],
    'chile/picante': ['chile', 'chiles', 'picante', 'hot sauce', 'chili'],
  };

  // Verificar que el AI esté confirmando amenidades
  const confirmationPhrases = [
    'he agregado a tu solicitud',
    'he añadido a tu solicitud',
    'te llevaremos',
    'te llevaré',
    'te enviaré',
    'te enviaremos',
    'i\'ve added to your request',
    'i\'ll bring you',
    'we\'ll bring you',
  ];

  const hasConfirmation = confirmationPhrases.some(phrase => 
    responseLower.includes(phrase)
  );

  if (!hasConfirmation) {
    return amenities;
  }

  if (logger) {
    logger.log('[AMENITIES] Checking for amenities in AI response');
  }

  // Buscar cada tipo de amenidad
  for (const [amenityName, keywords] of Object.entries(amenityKeywords)) {
    for (const keyword of keywords) {
      if (responseLower.includes(keyword)) {
        // Buscar cantidad asociada
        // Patrones: "cubiertos (2)", "2 cubiertos", "cubiertos para 2"
        
        // Patrón 1: keyword (número)
        const pattern1 = new RegExp(`${keyword}\\s*\\(?([0-9]+)\\)?`, 'i');
        const match1 = aiResponse.match(pattern1);
        
        // Patrón 2: número keyword
        const pattern2 = new RegExp(`([0-9]+)\\s*${keyword}`, 'i');
        const match2 = aiResponse.match(pattern2);
        
        // Patrón 3: keyword para número
        const pattern3 = new RegExp(`${keyword}\\s+para\\s+([0-9]+)`, 'i');
        const match3 = aiResponse.match(pattern3);

        let quantity = 1; // Default si no se especifica cantidad
        
        if (match1 && match1[1]) {
          quantity = parseInt(match1[1], 10);
        } else if (match2 && match2[1]) {
          quantity = parseInt(match2[1], 10);
        } else if (match3 && match3[1]) {
          quantity = parseInt(match3[1], 10);
        }

        amenities[amenityName] = quantity;

        if (logger) {
          logger.log(`[AMENITIES] Found: ${amenityName} x ${quantity}`);
        }

        break; // Ya encontramos esta amenidad, pasar a la siguiente
      }
    }
  }

  if (logger && Object.keys(amenities).length > 0) {
    logger.log(`[AMENITIES] Extracted: ${JSON.stringify(amenities)}`);
  }

  return amenities;
};
