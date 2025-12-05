import { Repository } from 'typeorm';
import { ConversationMessage } from '../entities/conversation-message.entity';

export interface SaveMessage {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  repository: Repository<ConversationMessage>;
}
