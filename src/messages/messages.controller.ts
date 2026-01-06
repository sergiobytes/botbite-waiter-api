import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  constructor(
    private readonly conversationService: ConversationService,
    private readonly queuesService: QueueService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleTwilioWebhook(@Body() body: WebhookDataTwilio) {
    // Agregar mensaje a cola para procesamiento asíncrono
    await this.queuesService.addInboundMessage(body);
    return { status: 'queued', message: 'Mensaje en proceso' };
  }

  @Get('conversations')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT, UserRoles.USER])
  async getConversationsByBranch(
    @Query() query: FindConversationsByBranchDto,
  ): Promise<ConversationsListResponse> {
    return this.conversationService.findByBranch(query.branchId);
  }
}
