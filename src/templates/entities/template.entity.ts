import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';

@Entity('templates')
export class Template extends BaseEntity {
  @Column({ unique: true })
  @Index()
  key: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'json' })
  content: {
    es: string;
    en: string;
  };

  @Column({ type: 'json', nullable: true })
  variables: string[];

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  category: string;
}
