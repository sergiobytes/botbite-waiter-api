import { Logger } from '@nestjs/common';
import { ConversationService } from '../services/conversation.service';

export const extractTableInfoFromConversationUtil = async (
  conversationId: string,
  service: ConversationService,
  logger: Logger,
): Promise<string> => {
  try {
    const { messages } = await service.getConversationHistory(conversationId);

    // Buscar en los mensajes del usuario de más reciente a más antiguo
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];

      if (msg.role === 'user') {
        const content = msg.content.toLowerCase().trim();

        // Patrón 8: Ubicaciones complejas (debe ir primero para evitar coincidencias parciales)
        // Español: "planta baja mesa 3"
        const plantaMatch = content.match(/planta\s+\w+\s+mesa\s+\d+/);
        if (plantaMatch) {
          return plantaMatch[0];
        }
        // Francés: "rez-de-chaussée table 3"
        const rezDeChausseeMatch = content.match(
          /rez[- ]de[- ]chaussee\s+table\s+\d+/,
        );
        if (rezDeChausseeMatch) {
          return rezDeChausseeMatch[0];
        }
        // Coreano: "1층 테이블 3"
        const koreanFloorTableMatch = content.match(/\d+층\s*테이블\s*\d+/);
        if (koreanFloorTableMatch) {
          return koreanFloorTableMatch[0];
        }

        // Patrón 1: "mesa 8" (español), "table 8" (inglés/francés), "테이블 8" (coreano)
        const mesaMatch = content.match(/mesa\s+(\d+)/);
        if (mesaMatch) {
          return `la mesa ${mesaMatch[1]}`;
        }
        const tableMatch = content.match(/table\s+(\d+)/);
        if (tableMatch) {
          return `la mesa ${tableMatch[1]}`;
        }
        const koreanTableMatch = content.match(/테이블\s*(\d+)/);
        if (koreanTableMatch) {
          return `la mesa ${koreanTableMatch[1]}`;
        }

        // Patrón 2: "en la mesa 8" (español), "at table 8" (inglés), "à la table 8" (francés), "테이블 8에" (coreano)
        const enLaMesaMatch = content.match(/en\s+la\s+mesa\s+(\d+)/);
        if (enLaMesaMatch) {
          return `la mesa ${enLaMesaMatch[1]}`;
        }
        const atTableMatch = content.match(/at\s+table\s+(\d+)/);
        if (atTableMatch) {
          return `la mesa ${atTableMatch[1]}`;
        }
        const aLaTableMatch = content.match(/a\s+la\s+table\s+(\d+)/);
        if (aLaTableMatch) {
          return `la mesa ${aLaTableMatch[1]}`;
        }
        const koreanAtTableMatch = content.match(/테이블\s*(\d+)에/);
        if (koreanAtTableMatch) {
          return `la mesa ${koreanAtTableMatch[1]}`;
        }

        // Patrón 4: solo un número "8"
        const numberMatch = content.match(/^(\d+)$/);
        if (numberMatch) {
          return `la mesa ${numberMatch[1]}`;
        }

        // Patrón 5: "C6", "A5", "B3" - formato letra + número
        const letterNumberMatch = content.match(/^([a-z])(\d+)$/);
        if (letterNumberMatch) {
          const letter = letterNumberMatch[1].toUpperCase();
          const number = letterNumberMatch[2];
          return `la mesa ${letter}${number}`;
        }

        // Patrón 6: "mesa C6" (español), "table C6" (inglés/francés), "테이블 A5" (coreano)
        const mesaLetterNumberMatch = content.match(/mesa\s+([a-z])(\d+)/);
        if (mesaLetterNumberMatch) {
          const letter = mesaLetterNumberMatch[1].toUpperCase();
          const number = mesaLetterNumberMatch[2];
          return `la mesa ${letter}${number}`;
        }
        const tableLetterNumberMatch = content.match(/table\s+([a-z])(\d+)/);
        if (tableLetterNumberMatch) {
          const letter = tableLetterNumberMatch[1].toUpperCase();
          const number = tableLetterNumberMatch[2];
          return `la mesa ${letter}${number}`;
        }
        const koreanTableLetterNumberMatch = content.match(
          /테이블\s*([a-zA-Z])(\d+)/,
        );
        if (koreanTableLetterNumberMatch) {
          const letter = koreanTableLetterNumberMatch[1].toUpperCase();
          const number = koreanTableLetterNumberMatch[2];
          return `la mesa ${letter}${number}`;
        }

        // Patrón 9: Ubicaciones especiales
        // Español: "terraza", "barra", "patio"
        // Inglés: "terrace", "bar", "patio"
        // Francés: "terrasse", "bar", "patio"
        // Coreano: "테라스", "바", "파티오"
        const ubicacionMatch = content.match(
          /(terraza|barra|patio|terrace|bar|terrasse|테라스|바|파티오)/,
        );
        if (ubicacionMatch) {
          return `la ${ubicacionMatch[1]}`;
        }
      }
    }

    // Si no se encontró información clara de la mesa o ubicación
    throw new Error(
      'Could not identify the table or location. Could you please specify which table or area you are referring to?',
    );
  } catch {
    logger.error(
      `Error extracting table information for conversation ${conversationId}`,
    );
    throw new Error(
      'Could not extract table information from the conversation history.',
    );
  }
};
