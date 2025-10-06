import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'restaurants' })
export class Restaurant extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({ name: 'user' })
  userId: string;

  @ManyToOne(() => User, (user) => user.restaurants, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'user' })
  user: User;
}
