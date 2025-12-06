import { Logger } from '@nestjs/common';
import { ConversationService } from '../services/conversation.service';

export const extractTableInfoFromConversationUtil = async (
  conversationId: string,
  service: ConversationService,
  logger: Logger,
): Promise<string> => {
  try {
    const { messages } = await service.getConversationHistory(conversationId);

    messages.forEach((msg) => {
      if (msg.role === 'user') {
        const content = msg.content.toLowerCase().trim();
        const mesaMatch = content.match(/mesa\s+(\d+)/);
        if (mesaMatch) {
          return `la mesa ${mesaMatch[1]}`;
        }

        const enLaMesaMatch = content.match(/en\s+la\s+mesa\s+(\d+)/);
        if (enLaMesaMatch) {
          return `la mesa ${enLaMesaMatch[1]}`;
        }

        const tableMatch = content.match(/table\s+(\d+)/);
        if (tableMatch) {
          return `la mesa ${tableMatch[1]}`;
        }

        const numberMatch = content.match(/^(\d+)$/);
        if (numberMatch) {
          return `la mesa ${numberMatch[1]}`;
        }

        const plantaMatch = content.match(/(planta\s+\w+\s+mesa\s+\d+)/);
        if (plantaMatch) {
          return plantaMatch[1];
        }

        const ubicacionMatch = content.match(/(terraza|barra|patio)/);
        if (ubicacionMatch) {
          return `la ${ubicacionMatch[1]}`;
        }
      }
    });

    return 'ubicación no especificada';
  } catch (error) {
    logger.warn('Could not extract table info from conversation:', error);
    return 'ubicación no especificada';
  }
};
