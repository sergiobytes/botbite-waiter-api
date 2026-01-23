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

        // Patrón 8: "planta baja mesa 3" (español), "rez-de-chaussée table 3" (francés), "1층 테이블 3" (coreano)
        const plantaMatch = content.match(/planta\s+\w+\s+mesa\s+\d+/);
        if (plantaMatch) {
          return plantaMatch[0];
        }
        const rezDeChausseeMatch = content.match(
          /rez[- ]de[- ]chaussee\s+table\s+\d+/,
        );
        if (rezDeChausseeMatch) {
          return rezDeChausseeMatch[0];
        }
        const koreanFloorTableMatch = content.match(/\d+층\s*테이블\s*\d+/);
        if (koreanFloorTableMatch) {
          return koreanFloorTableMatch[0];
        }

        // Patrón 1: "mesa 8" (español), "table 8" (inglés/francés), "테이블 8" (coreano)
        const mesaMatch = content.match(/^mesa\s+(\d+)$/);
        if (mesaMatch) {
          return `la mesa ${mesaMatch[1]}`;
        }
        const tableMatch = content.match(/^table\s+(\d+)$/);
        if (tableMatch) {
          return `la mesa ${tableMatch[1]}`;
        }
        const tableFrMatch = content.match(/^tableau\s+(\d+)$/); // francés alternativo
        if (tableFrMatch) {
          return `la mesa ${tableFrMatch[1]}`;
        }
        const koreanTableMatch = content.match(/^테이블\s*(\d+)$/);
        if (koreanTableMatch) {
          return `la mesa ${koreanTableMatch[1]}`;
        }

        // Patrón 2: "en la mesa 8" (español), "à la table 8" (francés), "테이블 8에" (coreano)
        const enLaMesaMatch = content.match(/^en\s+la\s+mesa\s+(\d+)$/);
        if (enLaMesaMatch) {
          return `la mesa ${enLaMesaMatch[1]}`;
        }
        const aLaTableMatch = content.match(/^a\s+la\s+table\s+(\d+)$/);
        if (aLaTableMatch) {
          return `la mesa ${aLaTableMatch[1]}`;
        }
        const koreanAtTableMatch = content.match(/^테이블\s*(\d+)에$/);
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

        // Patrón 6: "mesa C6", "mesa A5", "table C6" (francés/inglés), "테이블 A6" (coreano)
        const mesaLetterNumberMatch = content.match(/^mesa\s+([a-z])(\d+)$/);
        if (mesaLetterNumberMatch) {
          const letter = mesaLetterNumberMatch[1].toUpperCase();
          const number = mesaLetterNumberMatch[2];
          return `la mesa ${letter}${number}`;
        }
        const tableLetterNumberMatch = content.match(/^table\s+([a-z])(\d+)$/);
        if (tableLetterNumberMatch) {
          const letter = tableLetterNumberMatch[1].toUpperCase();
          const number = tableLetterNumberMatch[2];
          return `la mesa ${letter}${number}`;
        }
        const tableFrLetterNumberMatch = content.match(
          /^tableau\s+([a-z])(\d+)$/,
        );
        if (tableFrLetterNumberMatch) {
          const letter = tableFrLetterNumberMatch[1].toUpperCase();
          const number = tableFrLetterNumberMatch[2];
          return `la mesa ${letter}${number}`;
        }
        const koreanTableLetterNumberMatch = content.match(
          /^테이블\s*([a-zA-Z])(\d+)$/,
        );
        if (koreanTableLetterNumberMatch) {
          const letter = koreanTableLetterNumberMatch[1].toUpperCase();
          const number = koreanTableLetterNumberMatch[2];
          return `la mesa ${letter}${number}`;
        }

        // Patrón 9: ubicaciones "terraza", "barra", "patio" (español), "terrasse", "bar", "patio" (francés), "테라스", "바", "파티오" (coreano)
        const ubicacionMatch = content.match(
          /(terraza|barra|patio|terrasse|bar|파티오|테라스|바)/,
        );
        if (ubicacionMatch) {
          return `la ${ubicacionMatch[1]}`;
        }
      }
    }
    // Si no se encontró información clara de la mesa o ubicación
    throw new Error(
      'No se pudo identificar la mesa o ubicación. ¿Podrías indicar a qué mesa o zona te refieres?',
    );
  } catch {
    logger.error(
      `Error al extraer la información de la mesa para la conversación ${conversationId}`,
    );
    throw new Error(
      'No se pudo extraer la información de la mesa del historial de la conversación.',
    );
  }
};
