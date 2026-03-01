import { Injectable, Logger } from '@nestjs/common';
import { WebhookDataTwilio } from '../models/webhook-data.twilio';
import { ProcessIncomingMessageUseCase } from '../use-cases/messages/process-incoming-message.usecase';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly processIncomingMessageUseCase: ProcessIncomingMessageUseCase,
  ) { }

  async handleWhatsappTwilioMessage(body: WebhookDataTwilio) {
    const startTime = Date.now();
    this.logger.log(
      `[${new Date().toISOString()}] Received Twilio webhook: ${JSON.stringify(body, null, 2)}`,
    );

    try {
      await this.processIncomingMessage(body);
      const duration = Date.now() - startTime;
      this.logger.log(`Message processed successfully in ${duration}ms`);
    } catch (error) {
      this.logger.error('Error processing Twilio webhook');
      throw error;
    }
  }

  async processIncomingMessage(body: WebhookDataTwilio): Promise<void> {
    return await this.processIncomingMessageUseCase.execute(body);
  }
}
