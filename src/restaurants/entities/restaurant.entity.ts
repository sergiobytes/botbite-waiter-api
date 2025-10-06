import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { User } from '../../users/entities/user.entity';
import { Product } from '../../products/entities/product.entity';

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

  @OneToMany(() => Product, (product) => product.restaurant)
  products: Product[];
}
