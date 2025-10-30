import { Injectable, Logger } from '@nestjs/common';

import * as twilio from 'twilio';
import { processIncomingWhatsappMessageUseCase } from './use-cases/process-incoming-whatsapp-message.use-case';
import { WebhookDataTwilio } from '../../models/webhook-data.twilio';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private client: twilio.Twilio;

  constructor() {}

  processIncomingWhatsappMessage(webhookData: WebhookDataTwilio) {
    if (!this.client) throw new Error('Twilio client not initialized');

    return processIncomingWhatsappMessageUseCase(this.logger, webhookData);
  }
}
