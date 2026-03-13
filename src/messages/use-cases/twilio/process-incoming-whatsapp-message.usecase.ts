import { Injectable, Logger } from '@nestjs/common';
import { WebhookDataTwilio } from '../../models/webhook-data.twilio';

@Injectable()
export class ProcessIncomingWhatsappMessageUseCase {
  private readonly logger = new Logger(ProcessIncomingWhatsappMessageUseCase.name);

  constructor() { }

  execute(webhookData: WebhookDataTwilio) {
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
      this.logger.error(`Error sending WhatsApp message to ${To}:`, error);
      throw error;
    }
  };
}