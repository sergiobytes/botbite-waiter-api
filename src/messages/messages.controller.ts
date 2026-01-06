import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
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
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleTwilioWebhook(@Body() body: WebhookDataTwilio) {
    this.logger.log(`📥 Webhook received from: ${body.From}`);
    this.logger.log(`📝 Message: ${body.Body}`);

    try {
      // Agregar mensaje a cola para procesamiento asíncrono
      await this.queuesService.addInboundMessage(body);
      this.logger.log('✅ Message successfully queued');
      return { status: 'queued', message: 'Mensaje en proceso' };
    } catch (error) {
      this.logger.error('❌ Error queuing message:', error);
      throw error;
    }
  }

  @Get('conversations')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT, UserRoles.USER])
  async getConversationsByBranch(
    @Query() query: FindConversationsByBranchDto,
  ): Promise<ConversationsListResponse> {
    return this.conversationService.findByBranch(query.branchId);
  }
}
