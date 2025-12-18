import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  VersionColumn,
} from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { ConversationMessage } from './conversation-message.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { Customer } from '../../customers/entities/customer.entity';

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
  location?: string;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branchId' })
  branch?: Branch;

  @Column({ nullable: true })
  phoneNumber?: string;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'phoneNumber', referencedColumnName: 'phone' })
  customer?: Customer;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastActivity: Date;

  @Column({ type: 'json', nullable: true })
  lastOrderSentToCashier?: Record<
    string,
    { price: number; quantity: number; menuItemId: string; notes?: string }
  >;

  @Column({ type: 'timestamp', nullable: true })
  lastOrderSentAt?: Date;

  @Column({ type: 'json', nullable: true })
  amenities?: Record<string, number>;

  @Column({ type: 'boolean', default: false })
  isQrValidated: boolean;

  @OneToMany(() => ConversationMessage, (message) => message.conversation, {
    cascade: true,
  })
  messages: ConversationMessage[];
}
