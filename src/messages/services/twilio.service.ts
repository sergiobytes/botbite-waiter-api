import { Injectable, Logger } from '@nestjs/common';

import * as twilio from 'twilio';
import { processIncomingWhatsappMessageUseCase } from '../use-cases/twilio/process-incoming-whatsapp-message.use-case';
import { WebhookDataTwilio } from '../models/webhook-data.twilio';
import { sendWhatsappMessageUseCase } from '../use-cases/twilio/send-whatsapp-message.use-case';
import { MessageInstance } from 'twilio/lib/rest/api/v2010/account/message';
import { twilioConfig } from '../../config/twilio.config';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private client: twilio.Twilio;

  constructor() {
    this.client = twilio(twilioConfig.accountSid, twilioConfig.authToken);
  }

  processIncomingWhatsappMessage(webhookData: WebhookDataTwilio) {
    if (!this.client) throw new Error('Twilio client not initialized');

    return processIncomingWhatsappMessageUseCase(this.logger, webhookData);
  }

  async sendWhatsAppMessage(
    to: string,
    message: string,
    from: string,
  ): Promise<MessageInstance> {
    if (!this.client) throw new Error('Twilio client not initialized');

    return sendWhatsappMessageUseCase(
      to,
      message,
      from,
      this.logger,
      this.client,
    );
  }
}
