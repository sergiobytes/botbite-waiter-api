import { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';
import { SendMessage } from '../../interfaces/messages.interfaces';
import { splitLongMessageUtil } from '../../utils/split-long-message.util';

export const sendMessageUseCase = async (
  params: SendMessage,
): Promise<MessageInstance> => {
  const { customerPhone, message, assistantPhone, twilioService, logger } =
    params;

  try {
    // Split message if it's too long for WhatsApp
    const messageChunks = splitLongMessageUtil(message);

    let lastResponse: MessageInstance | null = null;

    // Send each chunk sequentially
    for (let i = 0; i < messageChunks.length; i++) {
      const chunk = messageChunks[i];

      logger.log(
        `Sending message chunk ${i + 1}/${messageChunks.length} to ${customerPhone} (${chunk.length} chars)`,
      );

      lastResponse = await twilioService.sendWhatsAppMessage(
        customerPhone,
        chunk,
        assistantPhone!,
      );

      // Small delay between messages to ensure proper order
      if (i < messageChunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    logger.log(
      `Message sent successfully to ${customerPhone} from branch ${assistantPhone} (${messageChunks.length} chunk${messageChunks.length > 1 ? 's' : ''})`,
    );

    return lastResponse!;
  } catch (error) {
    logger.error(`Failed to send message to ${customerPhone}:`, error);
    throw error;
  }
};
