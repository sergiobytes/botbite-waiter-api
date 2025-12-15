import { Column, Entity, Index, OneToMany, VersionColumn } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { ConversationMessage } from './conversation-message.entity';

@Entity({ name: 'conversations' })
export class Conversation extends BaseEntity {
  @Column({ unique: true })
  @Index()
  conversationId: string;

  @VersionColumn()
  version: number;

  @Column({ nullable: true })
  branchId?: string;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastActivity: Date;

  @Column({ type: 'json', nullable: true })
  lastOrderSentToCashier?: Record<
    string,
    { price: number; quantity: number; menuItemId: string; notes?: string }
  >;

  @Column({ type: 'json', nullable: true })
  amenities?: Record<string, number>; // {"cubiertos": 2, "servilletas": 5, etc.}

  @Column({ type: 'boolean', default: false })
  isQrValidated: boolean;

  @OneToMany(() => ConversationMessage, (message) => message.conversation, {
    cascade: true,
  })
  messages: ConversationMessage[];
}
