import { Injectable, Logger } from '@nestjs/common';
import { Twilio } from 'twilio';

@Injectable()
export class SendWhatsappMessageUseCase {
  private readonly logger = new Logger(SendWhatsappMessageUseCase.name);

  constructor() { }

  async execute(to: string, message: string, from: string, client: Twilio, mediaUrl?: string,) {
    try {
      const whatsappNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
      const fromNumber = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;

      const messagePayload: any = {
        body: message,
        from: fromNumber,
        to: whatsappNumber,
      };

      // Agregar mediaUrl si existe
      if (mediaUrl) {
        messagePayload.mediaUrl = [mediaUrl];
        this.logger.log(`Sending message with media to ${to}: ${mediaUrl}`);
      }

      const messageResponse = await client.messages.create(messagePayload);

      this.logger.log(`WhatsApp message sent to ${to}: ${messageResponse.sid}`);
      return messageResponse;
    } catch (error) {
      this.logger.error(`Error sending WhatsApp message to ${to}:`, error);
      throw error;
    }
  };
}