import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { TwilioService } from './services/twilio/twilio.service';

@Module({
  imports: [],
  controllers: [MessagesController],
  providers: [MessagesService, TwilioService],
  exports: [MessagesService, TwilioService],
})
export class MessagesModule {}
