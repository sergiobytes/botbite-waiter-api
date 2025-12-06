import { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';
import { SendMessage } from '../../interfaces/messages.interfaces';

export const sendMessageUseCase = async (
  params: SendMessage,
): Promise<MessageInstance> => {
  const { customerPhone, message, assistantPhone, twilioService, logger } =
    params;

  try {
    const response = await twilioService.sendWhatsAppMessage(
      customerPhone,
      message,
      assistantPhone,
    );

    logger.log(
      `Message sent successfully to ${customerPhone} from branch ${assistantPhone}`,
    );

    return response;
  } catch (error) {
    logger.error(`Failed to send message to ${customerPhone}:`, error);
    throw error;
  }
};
