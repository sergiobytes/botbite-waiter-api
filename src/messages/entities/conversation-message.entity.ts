import { Conversation } from './conversation.entity';
import { BaseEntity } from '../../common/base.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

@Entity({ name: 'conversation_messages' })
export class ConversationMessage extends BaseEntity {
  @Column()
  conversationId: string;

  @Column({ type: 'enum', enum: ['user', 'assistant'] })
  role: 'user' | 'assistant';

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'conversationId',
    referencedColumnName: 'conversationId', // ← IMPORTANTE: Especificar el campo correcto
  })
  conversation: Conversation;
}
