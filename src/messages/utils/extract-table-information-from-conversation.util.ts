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

        // Patrón 6: "mesa C6", "mesa A5"
        const mesaLetterNumberMatch = content.match(/mesa\s+([a-z])(\d+)/);
        if (mesaLetterNumberMatch) {
          const letter = mesaLetterNumberMatch[1].toUpperCase();
          const number = mesaLetterNumberMatch[2];
          return `la mesa ${letter}${number}`;
        }

        // Patrón 7: "table C6" (inglés)
        const tableLetterNumberMatch = content.match(/table\s+([a-z])(\d+)/);
        if (tableLetterNumberMatch) {
          const letter = tableLetterNumberMatch[1].toUpperCase();
          const number = tableLetterNumberMatch[2];
          return `la mesa ${letter}${number}`;
        }

        // Patrón 8: "planta baja mesa 3"
        const plantaMatch = content.match(/(planta\s+\w+\s+mesa\s+\d+)/);
        if (plantaMatch) {
          return plantaMatch[1];
        }
        
        // Patrón 9: "terraza", "barra", "patio"
