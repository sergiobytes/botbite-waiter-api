import { Injectable } from '@nestjs/common';
import * as twilio from 'twilio';
import { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';
import { twilioConfig } from '../../config/twilio.config';
import { WebhookDataTwilio } from '../models/webhook-data.twilio';
import { ProcessIncomingWhatsappMessageUseCase } from '../use-cases/twilio/process-incoming-whatsapp-message.usecase';
import { SendWhatsappMessageUseCase } from '../use-cases/twilio/send-whatsapp-message.usecase';

@Injectable()
export class TwilioService {
  private client: twilio.Twilio;

  constructor(
    private readonly processIncomingWhatsappMessageUseCase: ProcessIncomingWhatsappMessageUseCase,
    private readonly sendWhatsappMessageUseCase: SendWhatsappMessageUseCase,
  ) {
    this.client = twilio(twilioConfig.accountSid, twilioConfig.authToken);
  }

  processIncomingWhatsappMessage(webhookData: WebhookDataTwilio) {
    if (!this.client) throw new Error('Twilio client not initialized');

    return this.processIncomingWhatsappMessageUseCase.execute(webhookData);
  }

  async sendWhatsAppMessage(to: string, message: string, from: string, mediaUrl?: string,): Promise<MessageInstance> {
    if (!this.client) throw new Error('Twilio client not initialized');

    return await this.sendWhatsappMessageUseCase.execute(to, message, from, this.client, mediaUrl,);
  }
}
