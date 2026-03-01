import { Conversation } from '../entities/conversation.entity';
export interface ConversationsListResponse {
  conversations: Conversation[];
  total: number;
}
