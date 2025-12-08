import { Logger } from '@nestjs/common';
import { containsTableInfo } from './contains-table-info.util';

export const filterHistoryAfterLastConfirmation = (
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  logger: Logger,
): Array<{ role: 'user' | 'assistant'; content: string }> => {
  const confirmationIndices: number[] = [];
  let tableInfoMessage: {
    role: 'user' | 'assistant';
    content: string;
  } | null = null;

  for (let i = 0; i < history.length; i++) {
    const message = history[i];

    if (message.role === 'user' && containsTableInfo(message.content)) {
      tableInfoMessage = message;
      if (i + 1 < history.length) {
        const assistantResponse = history[i + 1];
        if (assistantResponse.role === 'assistant') {
          tableInfoMessage = {
            role: 'assistant',
            content: `${message.content} | ${assistantResponse.content}`,
          };
        }
      }
    }

    if (
      message.role === 'assistant' &&
      message.content.includes('Tu pedido está ahora en proceso')
    ) {
      confirmationIndices.push(i);
    }
  }

  if (confirmationIndices.length === 0) {
    return history;
  }

  const filteredHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }> = [];

  if (tableInfoMessage) {
    filteredHistory.push(tableInfoMessage);
  }

  for (const index of confirmationIndices) {
    filteredHistory.push(history[index]);
  }

  const lastConfirmationIndex =
    confirmationIndices[confirmationIndices.length - 1];
  const messagesAfterLastConfirmation = history.slice(
    lastConfirmationIndex + 1,
  );
  filteredHistory.push(...messagesAfterLastConfirmation);

  logger.log(
    `Filtered history: keeping table info + ${confirmationIndices.length} confirmations + ${messagesAfterLastConfirmation.length} messages after last confirmation`,
  );

  return filteredHistory;
};
