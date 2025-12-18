import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { MessagesService } from './services/messages.service';
import { WebhookDataTwilio } from './models/webhook-data.twilio';
import { ConversationService } from './services/conversation.service';
import { FindConversationsByBranchDto } from './dto/find-conversations-by-branch.dto';
import { ConversationsListResponse } from './interfaces/messages.interfaces';
import { Auth } from '../auth/decorators/auth.decorator';
import { UserRoles } from '../users/enums/user-roles';

@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly conversationService: ConversationService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleTwilioWebhook(@Body() body: WebhookDataTwilio) {
    return this.messagesService.handleWhatsappTwilioMessage(body);
  }

  @Get('conversations')
  @Auth([UserRoles.SUPER, UserRoles.ADMIN, UserRoles.CLIENT, UserRoles.USER])
  async getConversationsByBranch(
    @Query() query: FindConversationsByBranchDto,
  ): Promise<ConversationsListResponse> {
    return this.conversationService.findByBranch(query.branchId);
  }
}
