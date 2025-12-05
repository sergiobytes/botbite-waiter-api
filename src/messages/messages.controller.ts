import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { MessagesService } from './services/messages.service';
import { WebhookDataTwilio } from './models/webhook-data.twilio';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleTwilioWebhook(@Body() body: WebhookDataTwilio) {
    return this.messagesService.handleWhatsappTwilioMessage(body);
  }
}
