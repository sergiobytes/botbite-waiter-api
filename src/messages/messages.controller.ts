import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { WebhookDataTwilio } from './models/webhook-data.twilio';
import { ConversationService } from './services/conversation.service';
import { FindConversationsByBranchDto } from './dto/find-conversations-by-branch.dto';
import { ConversationsListResponse } from './interfaces/messages.interfaces';
import { Auth } from '../auth/decorators/auth.decorator';
import { UserRoles } from '../users/enums/user-roles';
import { QueueService } from '../queue/queue.service';

@Controller('messages')
export class MessagesController {
  private readonly logger = new Logger(MessagesController.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly queuesService: QueueService,
  ) { }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleTwilioWebhook(@Body() body: WebhookDataTwilio) {
    this.logger.log(`📥 Webhook received from: ${body.From}`);
    this.logger.log(`📝 Message: ${body.Body}`);

    // Fire-and-forget: encolar sin bloquear respuesta a Twilio
    this.queuesService
      .addInboundMessage(body)
      .then(() => this.logger.log('✅ Message successfully queued'))
      .catch((error) => this.logger.error('❌ Error queuing message:', error));

    // Responder inmediatamente a Twilio
    return { status: 'queued', message: 'Mensaje en proceso' };
  }

  @Get('conversations')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT, UserRoles.USER])
  async getConversationsByBranch(
    @Query() query: FindConversationsByBranchDto,
  ): Promise<ConversationsListResponse> {
    return this.conversationService.findByBranch(query.branchId);
  }

  @Get('notifications')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  async getNotificationsByBranch(
    @Query() query: FindConversationsByBranchDto,
  ) {
    return await this.conversationService.getNotificationsByBranch(query.branchId);
  }

  @Patch(':notificationId/read')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  async markNotificationAsRead(@Param('notificationId', ParseUUIDPipe) notificationId: string) {
    await this.conversationService.markNotificationAsRead(notificationId);
  }

  @Patch(':notificationId/unread')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT])
  async markNotificationAsUnread(@Param('notificationId', ParseUUIDPipe) notificationId: string) {
    await this.conversationService.markNotificationAsUnread(notificationId);
  }
}
