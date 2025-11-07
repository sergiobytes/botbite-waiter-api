import {
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: true, type: 'boolean' })
  isActive: boolean;

  @CreateDateColumn({ 
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP' 
  })
  createdAt: Date;

  @UpdateDateColumn({ 
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP' 
  })
  updatedAt: Date;
}
