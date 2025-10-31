import { Logger } from '@nestjs/common';
import { WebhookDataTwilio } from '../../../../messages/models/webhook-data.twilio';

export const processIncomingWhatsappMessageUseCase = (
  logger: Logger,
  webhookData: WebhookDataTwilio,
) => {
  const { from, to } = webhookData;

  try {
    const toPhoneNumber = to.startsWith('whatsapp:')
      ? to.replace('whatsapp:', '')
      : to;

    const fromPhoneNumber = from.startsWith('whatsapp:')
      ? from.replace('whatsapp:', '')
      : from;

    return {
      from: fromPhoneNumber,
      to: toPhoneNumber,
      message: webhookData.body,
      messageSid: webhookData.messageSid,
      profileName: webhookData.profileName,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error(`Error sending WhatsApp message to ${to}:`, error);
    throw error;
  }
};
