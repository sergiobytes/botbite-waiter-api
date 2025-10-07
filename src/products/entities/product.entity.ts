import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { Restaurant } from '../../restaurants/entities/restaurant.entity';

@Entity({ name: 'products' })
export class Product extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  restaurantId: string;

  @ManyToOne(() => Restaurant, (restaurant) => restaurant.products, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;
}
