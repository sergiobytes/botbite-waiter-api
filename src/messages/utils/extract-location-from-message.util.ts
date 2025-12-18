/**
 * Extrae la información de ubicación/mesa de un mensaje de usuario
 * @param message - El mensaje del usuario
 * @returns La ubicación formateada o null si no se encuentra
 */
export const extractLocationFromMessageUtil = (
  message: string,
): string | null => {
  const content = message.toLowerCase().trim();

  // Patrón 1: "mesa 8" o "Mesa 8"
  const mesaMatch = content.match(/mesa\s+(\d+)/);
  if (mesaMatch) {
    return `la mesa ${mesaMatch[1]}`;
  }

  // Patrón 2: "en la mesa 8"
  const enLaMesaMatch = content.match(/en\s+la\s+mesa\s+(\d+)/);
  if (enLaMesaMatch) {
    return `la mesa ${enLaMesaMatch[1]}`;
  }

  // Patrón 3: "table 8" (inglés)
  const tableMatch = content.match(/table\s+(\d+)/);
  if (tableMatch) {
    return `la mesa ${tableMatch[1]}`;
  }

  // Patrón 4: solo un número "8" (pero solo si el mensaje es corto, para evitar falsos positivos)
  if (content.length <= 3) {
    const numberMatch = content.match(/^(\d+)$/);
    if (numberMatch) {
      return `la mesa ${numberMatch[1]}`;
    }
  }

  // Patrón 5: "planta baja mesa 3" o "planta alta mesa 5"
  const plantaMatch = content.match(/(planta\s+\w+\s+mesa\s+\d+)/);
  if (plantaMatch) {
    return plantaMatch[1];
  }

  // Patrón 6: "terraza", "barra", "patio"
  const ubicacionMatch = content.match(/(terraza|barra|patio)/);
  if (ubicacionMatch) {
    return `la ${ubicacionMatch[1]}`;
  }

  // Patrón 7: "estoy en la terraza", "estamos en el patio"
  const estoyEnMatch = content.match(/est[oáa]y?\s+en\s+(la\s+)?(terraza|barra|patio|mesa\s+\d+)/);
  if (estoyEnMatch) {
    const location = estoyEnMatch[2];
    if (location.startsWith('mesa')) {
      return `la ${location}`;
    }
    return `la ${location}`;
  }

  return null;
};
