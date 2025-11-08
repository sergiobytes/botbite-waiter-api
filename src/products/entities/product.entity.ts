import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { Restaurant } from '../../restaurants/entities/restaurant.entity';
import { normalizeProductName } from '../../common/utils/normalize-product-name';

@Entity({ name: 'products' })
export class Product extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true })
  normalizedName: string;

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

  @BeforeInsert()
  @BeforeUpdate()
  toUpperCaseFields() {
    if (this.name) {
      this.name = this.name.toUpperCase();
      this.normalizedName = normalizeProductName(this.name);
    }
    if (this.description) this.description = this.description.toUpperCase();
  }
}
