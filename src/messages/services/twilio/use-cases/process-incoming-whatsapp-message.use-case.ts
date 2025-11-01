import { Logger } from '@nestjs/common';
import { WebhookDataTwilio } from '../../../../messages/models/webhook-data.twilio';

export const processIncomingWhatsappMessageUseCase = (
  logger: Logger,
  webhookData: WebhookDataTwilio,
) => {
  const { From, To } = webhookData;

  try {
    const toPhoneNumber = To.startsWith('whatsapp:')
      ? To.replace('whatsapp:', '')
      : To;

    const fromPhoneNumber = From.startsWith('whatsapp:')
      ? From.replace('whatsapp:', '')
      : From;

    return {
      from: fromPhoneNumber,
      to: toPhoneNumber,
      message: webhookData.Body,
      messageSid: webhookData.MessageSid,
      profileName: webhookData.ProfileName,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error(`Error sending WhatsApp message to ${To}:`, error);
    throw error;
  }
};
