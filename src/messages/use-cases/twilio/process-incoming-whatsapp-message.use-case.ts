import { Logger } from '@nestjs/common';
import { WebhookDataTwilio } from '../../models/webhook-data.twilio';

export const processIncomingWhatsappMessageUseCase = (
  logger: Logger,
  webhookData: WebhookDataTwilio,
) => {
  const { From, To, NumMedia, MediaUrl0, MediaContentType0 } = webhookData;

  try {
    const toPhoneNumber = To.startsWith('whatsapp:')
      ? To.replace('whatsapp:', '')
      : To;

    const fromPhoneNumber = From.startsWith('whatsapp:')
      ? From.replace('whatsapp:', '')
      : From;

    const hasAudio = NumMedia && parseInt(NumMedia) > 0 && MediaUrl0;

    return {
      from: fromPhoneNumber,
      to: toPhoneNumber,
      message: webhookData.Body,
      messageSid: webhookData.MessageSid,
      profileName: webhookData.ProfileName,
      timestamp: new Date().toISOString(),
      hasAudio: !!hasAudio,
      audioUrl: MediaUrl0 || null,
      audioMimeType: MediaContentType0 || null,
    };
  } catch (error) {
    logger.error(`Error sending WhatsApp message to ${To}:`, error);
    throw error;
  }
};
